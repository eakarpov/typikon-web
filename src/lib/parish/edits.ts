import clientPromise from "@/lib/mongodb";
import type { Gathering, ParishDay, Part } from "./types";

// ПРАВКА НАСТОЯТЕЛЯ — «проект, который остаётся поправить, а не составить».
//
// Два хранилища, и они не пишут друг в друга. Сгенерированное расписание не
// хранится вовсе: оно выводится из устава и приходских правил заново, и лежачая
// копия только разошлась бы с ними. Хранятся ПРАВКИ — и пересборка месяца их
// не касается никогда.
//
// Итог считается на чтение: устав плюс правила дают проект, правки ложатся
// поверх. Оттого правка переживает и правку правил, и пересборку корпуса.

export type EditOp = "time" | "title" | "cancel" | "add";

export interface ParishEdit {
    _id?: string;
    parishSlug: string;
    month: string;
    date: string;
    part: Part;
    /**
     * ЯКОРЬ — по составу собрания, а не по номеру в списке.
     *
     * Порядковый номер съезжает от вставленного молебна, и правка «второе
     * собрание в 18:00» назавтра попадёт не туда. Состав не съезжает: пока
     * служится то же, правка держится за него. Тот же приём, что у устойчивых
     * uid в подписном календаре.
     */
    gatheringKey: string;
    op: EditOp;
    value: { time?: string; title?: string; services?: string[] };
    /**
     * Что было сгенерировано в тот миг, когда правку делали. Только этим и
     * можно узнать, что устав с тех пор передумал: сравнить не с текущей
     * правкой, а с тем, поверх чего её клали.
     */
    baseline: { time?: string | null; title?: string };
    note?: string;
    createdAt: Date;
    createdBy?: string;
}

export type EditStatus = "active" | "stale" | "orphaned";

const collection = async () =>
    (await clientPromise).db("typikon").collection<ParishEdit>("parishEdits");

export const editsOf = async (parishSlug: string, month: string) =>
    (await collection()).find({ parishSlug, month }).sort({ createdAt: 1 }).toArray();

export const saveEdit = async (edit: Omit<ParishEdit, "_id" | "createdAt">) => {
    const col = await collection();
    // Одна правка на (собрание, действие): вторая правка часа — не вторая
    // запись, а замена первой, иначе история решений станет их спором.
    const _id = `${edit.parishSlug}:${edit.date}:${edit.part}:${edit.op}:${edit.gatheringKey}`;
    const doc = { ...edit, _id, createdAt: new Date() } as ParishEdit;
    await col.replaceOne({ _id } as never, doc as never, { upsert: true });
    return _id;
};

export const dropEdit = async (id: string) =>
    (await collection()).deleteOne({ _id: id });

export interface AppliedEdit extends ParishEdit {
    status: EditStatus;
    /** Что устав предлагает сейчас, если он передумал. */
    now?: { time?: string | null; title?: string };
}

/**
 * Наложить правки на проект расписания.
 *
 * Правка со сбитым основанием НЕ ОТМЕНЯЕТСЯ, а помечается. Молча вернуть
 * уставное значение значило бы стереть решение настоятеля — и стереть тихо,
 * так что он узнал бы об этом со стенда. Помеченную он увидит и решит сам.
 */
export const applyEdits = (
    days: ParishDay[],
    edits: ParishEdit[],
): { days: ParishDay[]; applied: AppliedEdit[] } => {
    const byDate = new Map<string, ParishEdit[]>();
    for (const e of edits) {
        const list = byDate.get(e.date);
        if (list) list.push(e); else byDate.set(e.date, [e]);
    }

    const applied: AppliedEdit[] = [];
    const out = days.map(day => {
        const mine = byDate.get(day.date);
        if (!mine?.length) return day;

        let gatherings = day.gatherings.slice();

        for (const e of mine) {
            const i = gatherings.findIndex(g => g.key === e.gatheringKey);

            if (e.op === "add") {
                // Собственное собрание настоятеля от устава не зависит и
                // осиротеть не может: оно и заведено помимо него
                const g: Gathering = {
                    key: e.gatheringKey, civil: e.date, part: e.part,
                    partLabel: "", time: e.value.time ?? null,
                    title: e.value.title ?? "Служба", belongsTo: null,
                    duration: null,
                    services: (e.value.services ?? []).map(k => ({ key: k, label: k, own: true })),
                    why: [{ kind: "parish", text: e.note ?? "добавлено настоятелем" }],
                    edited: true,
                };
                gatherings.push(g);
                applied.push({ ...e, status: "active" });
                continue;
            }

            if (i < 0) {
                // ЯКОРЯ НЕТ: устав больше не назначает этого собрания. Правка
                // остаётся видимой, а не пропадает вместе с ним
                applied.push({ ...e, status: "orphaned" });
                continue;
            }

            const g = gatherings[i];
            const nowValue = { time: g.time, title: g.title };
            const drifted = (e.baseline.time !== undefined && e.baseline.time !== g.time)
                || (e.baseline.title !== undefined && e.baseline.title !== g.title);

            if (e.op === "cancel") {
                gatherings[i] = { ...g, cancelled: true, edited: true,
                    why: [...g.why, { kind: "parish", text: e.note ?? "отменено настоятелем" }] };
            } else {
                gatherings[i] = {
                    ...g,
                    time: e.op === "time" ? (e.value.time ?? g.time) : g.time,
                    title: e.op === "title" ? (e.value.title ?? g.title) : g.title,
                    edited: true,
                    why: [...g.why, {
                        kind: "parish",
                        text: e.note ?? (e.op === "time"
                            ? `час поставлен настоятелем: ${e.value.time}`
                            : `название дано настоятелем`),
                    }],
                };
            }
            applied.push({ ...e, status: drifted ? "stale" : "active", now: nowValue });
        }

        gatherings.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
        return { ...day, gatherings };
    });

    return { days: out, applied };
};
