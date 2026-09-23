// Святые текста — ключом нашего каталога.
//
// Текст ссылается на святого двумя полями с номерами святцев: `dneslovId` — чей
// это текст (к чьей памяти писан) и `mentionIds` — кто упомянут в теле. Номер
// остаётся внешним ключом: его отдаёт API, на нём держатся связи с приложением.
// Но у святых нашего корпуса — Собора новомучеников и святых из памятей Минеи —
// номера нет, и выборки «тексты святого», «упоминания», «к этой же памяти»
// по номеру их не видели бы. Поэтому рядом лежат ключи каталога: `saintId` и
// `mentionSaintIds`, и выборки идут по ним.
//
// ОДНА ФУНКЦИЯ СВЕРКИ на всех, кто пишет тексты: разовый перенос
// (sync-text-saints.ts), редактор текста, применение упоминаний. Иначе ключи
// разошлись бы с номерами при первой правке.
//
// Кто главнее. Святой, заданный ключом (`saintId`, редактор теперь принимает
// адрес), — главный: номер у записи из снимка dneslov дописывается обратно,
// чтобы API не потерял его. Святой, заданный только номером, получает ключ по
// номеру. Упоминания размечаются по номерам (ревью /admin/mentions) и ключи
// получают по ним.

import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

const DNESLOV = "dneslov";

/** Номер святцев → ключ записи каталога и обратно — одним запросом на весь каталог. */
const catalogKeys = async () => {
    const rows = await (await clientPromise).db("typikon").collection("saints")
        .find({}, { projection: { externals: 1 } }).toArray();
    const byNumber = new Map<string, string>();
    const numberOf = new Map<string, string>();
    for (const s of rows as any[]) {
        const id = String(s._id);
        const numbers = (s.externals ?? []).filter((e: any) => e.source === DNESLOV).map((e: any) => String(e.id));
        numbers.forEach((n: string) => byNumber.set(n, id));
        if (numbers[0]) numberOf.set(id, numbers[0]);
        numberOf.set(`exists:${id}`, "1");
    }
    return { byNumber, numberOf };
};

export interface SyncReport { seen: number; updated: number; unmapped: Set<string> }

/** Сверить ключи каталога у текстов под фильтром. Пустой фильтр — весь корпус. */
export const syncTextSaints = async (filter: Record<string, unknown> = {}, write = true): Promise<SyncReport> => {
    const texts = (await clientPromise).db("typikon").collection("texts");
    const { byNumber, numberOf } = await catalogKeys();
    const rows = await texts.find(
        { ...filter, $or: [{ dneslovId: { $nin: [null, ""] } }, { mentionIds: { $exists: true, $ne: [] } }, { saintId: { $nin: [null, ""] } }, { mentionSaintIds: { $exists: true } }] },
        { projection: { dneslovId: 1, mentionIds: 1, saintId: 1, mentionSaintIds: 1, mentions: 1 } },
    ).toArray();

    const report: SyncReport = { seen: rows.length, updated: 0, unmapped: new Set() };
    const ops: any[] = [];
    for (const t of rows as any[]) {
        const number = t.dneslovId ? String(t.dneslovId).trim() : "";
        const explicit = t.saintId && numberOf.has(`exists:${String(t.saintId)}`) ? String(t.saintId) : null;
        const saintId = explicit ?? (number ? byNumber.get(number) ?? null : null);
        if (number && !byNumber.has(number)) report.unmapped.add(number);
        // Святой задан ключом, а номера у текста нет — дописываем номер записи, если он у неё есть.
        const dneslovId = !number && explicit ? numberOf.get(explicit) ?? null : undefined;

        // Упоминания: ключи по номерам, и те, что уже поставлены ключом напрямую
        // (разбор упоминаний теперь решает по ключу, и у святого корпуса номера нет).
        const fromNumbers = ((t.mentionIds ?? []) as string[]).map((n) => {
            const key = byNumber.get(String(n));
            if (!key) report.unmapped.add(String(n));
            return key;
        });
        const direct = ((t.mentions ?? []) as any[]).map((m) => m?.saintId).filter((k) => k && numberOf.has(`exists:${k}`));
        const mentionSaintIds = [...new Set([...fromNumbers, ...direct].filter(Boolean))] as string[];
        // Контекст упоминания — тоже с ключом, чтобы страница святого находила свою строку.
        const mentions = ((t.mentions ?? []) as any[]).map((m) =>
            m && !m.saintId && m.dneslovId && byNumber.has(String(m.dneslovId)) ? { ...m, saintId: byNumber.get(String(m.dneslovId)) } : m);

        const set: Record<string, unknown> = {};
        if ((t.saintId || null) !== saintId) set.saintId = saintId;
        if (JSON.stringify(t.mentionSaintIds ?? []) !== JSON.stringify(mentionSaintIds)) set.mentionSaintIds = mentionSaintIds;
        if (dneslovId) set.dneslovId = dneslovId;
        if (JSON.stringify(mentions) !== JSON.stringify(t.mentions ?? [])) set.mentions = mentions;
        if (Object.keys(set).length) {
            report.updated++;
            ops.push({ updateOne: { filter: { _id: t._id }, update: { $set: set } } });
        }
    }
    if (write && ops.length) await texts.bulkWrite(ops, { ordered: false });
    return report;
};

/**
 * Очередь кандидатов упоминаний — с ключом каталога. Кандидаты прежних прогонов
 * лежат с номером святцев; ключ им дописывается по номеру.
 */
export const syncMentionCandidates = async (write = true): Promise<number> => {
    const col = (await clientPromise).db("typikon").collection("mentionCandidates");
    const { byNumber } = await catalogKeys();
    const rows = await col.find({ saintId: { $in: [null, ""] }, dneslovId: { $nin: [null, ""] } },
        { projection: { dneslovId: 1 } }).toArray();
    const ops = rows
        .filter((r: any) => byNumber.has(String(r.dneslovId)))
        .map((r: any) => ({ updateOne: { filter: { _id: r._id }, update: { $set: { saintId: byNumber.get(String(r.dneslovId)) } } } }));
    if (write && ops.length) await col.bulkWrite(ops, { ordered: false });
    return ops.length;
};

/** Сверить один текст — после правки в редакторе. */
export const syncTextSaintsOf = async (ids: (string | ObjectId)[]) => {
    const oids = ids.map((id) => (typeof id === "string" ? (ObjectId.isValid(id) ? new ObjectId(id) : null) : id)).filter(Boolean);
    if (!oids.length) return;
    await syncTextSaints({ _id: { $in: oids } });
};
