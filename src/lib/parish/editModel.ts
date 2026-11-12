import {liturgySlotLabel} from "./practice";
import {detailServices,nextDayLabel,type ServiceDetails} from "./serviceDetails";
import { composedServices, SERVICE_CHOICES } from "./dayConfig";
import { PART_LABELS, type Gathering, type ParishDay, type Part } from "./types";
export type EditOp = "time" | "title" | "cancel" | "add" | "compose";
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
    value: {
        time?: string;
        title?: string;
        services?: string[];
        details?:ServiceDetails;
        part?: Part;
    };
    /**
     * Что было сгенерировано в тот миг, когда правку делали. Только этим и
     * можно узнать, что устав с тех пор передумал: сравнить не с текущей
     * правкой, а с тем, поверх чего её клали.
     */
    baseline: {
        time?: string | null;
        title?: string;
    };
    note?: string;
    createdAt: Date;
    createdBy?: string;
}
export type EditStatus = "active" | "stale" | "orphaned";
export interface AppliedEdit extends ParishEdit {
    status: EditStatus;
    /** Что устав предлагает сейчас, если он передумал. */
    now?: {
        time?: string | null;
        title?: string;
    };
}
/**
 * Наложить правки на проект расписания.
 *
 * Правка со сбитым основанием НЕ ОТМЕНЯЕТСЯ, а помечается. Молча вернуть
 * уставное значение значило бы стереть решение ответственного — и стереть тихо,
 * так что он узнал бы об этом со стенда. Помеченную он увидит и решит сам.
 */
export const applyEdits = (days: ParishDay[], edits: ParishEdit[]): {
    days: ParishDay[];
    applied: AppliedEdit[];
} => {
    const byDate = new Map<string, ParishEdit[]>();
    for (const e of edits) {
        const list = byDate.get(e.date);
        if (list)
            list.push(e);
        else
            byDate.set(e.date, [e]);
    }
    const applied: AppliedEdit[] = [];
    const out = days.map(day => {
        const mine = byDate.get(day.date);
        if (!mine?.length)
            return day;
        let gatherings = day.gatherings.slice();
        for (const e of mine) {
            const i = gatherings.findIndex(g => g.key === e.gatheringKey);
            if (e.op === "add") {
                // Собственное собрание ответственного от устава не зависит и
                // осиротеть не может: оно и заведено помимо него
                const g: Gathering = {
                    key: e.gatheringKey, civil: e.date, part: e.part,
                    partLabel: PART_LABELS[e.part], serviceSign:e.part==="vecher"?day.eveningSign??day.sign:day.sign, time: e.value.time ?? null,
                    title: e.value.services?.length && e.value.services.every(k => SERVICE_CHOICES.some(s => s[0] === k)) ? composedServices(e.value.services, e.part === 'vecher' ? day.eveningSign ?? day.sign : day.sign).map(s => s.label).join('. ') : e.value.title ?? "Служба", belongsTo: null,
                    duration: null,
                    services: composedServices(e.value.services ?? [], e.part === 'vecher' ? day.eveningSign ?? day.sign : day.sign),
                    why: [{ kind: "parish", text: e.note ?? "добавлено руками" }],
                    edited: true,
                };
                g.details=e.value.details;g.services=detailServices(g.services,g.details);
                if(g.details)g.title=g.services.map(s=>s.label).join(". ");
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
            if (e.op === 'compose') {
                const part=e.value.part??g.part;
                const sign=part===g.part?g.serviceSign??(part==="vecher"?day.eveningSign??day.sign:day.sign):part==="vecher"?day.eveningSign??day.sign:day.sign;
                const services = detailServices(composedServices(e.value.services ?? [], sign),e.value.details);
                const count=day.dayConfig?.morningLiturgies??day.defaultMorningLiturgies??1;
                const title=services.map(s=>(g.liturgySlot&&count>1&&(s.key==='liturgy'||s.key.startsWith('liturgy-'))?liturgySlotLabel(g.liturgySlot,count)+' ':'')+s.label).join('. ');
                gatherings[i] = { ...g, part, partLabel:PART_LABELS[part], serviceSign:sign, time: e.value.time ?? g.time, title, services, details:e.value.details, edited: true,
                    why: [...g.why, { kind: 'parish', text: 'состав богослужения выбран вручную' }] };
            }
            else if (e.op === "cancel") {
                gatherings[i] = { ...g, cancelled: true, edited: true,
                    why: [...g.why, { kind: "parish", text: e.note ?? "отменено руками" }] };
            }
            else {
                gatherings[i] = {
                    ...g,
                    time: e.op === "time" ? (e.value.time ?? g.time) : g.time,
                    title: e.op === "title" ? (e.value.title ?? g.title) : g.title,
                    edited: true,
                    // «РУКАМИ» — а не «ответственным»: читающему «почему» важно
                    // не кто, а ЧЕМ поставлено. Правило видно по имени правила,
                    // правка — вот этим словом; имя правившего лежит в
                    // createdBy и показывается там, где оно к месту
                    why: [...g.why, {
                            kind: "parish",
                            text: e.note ?? (e.op === "time"
                                ? `час поставлен руками: ${e.value.time}`
                                : `название дано руками`),
                        }],
                };
            }
            applied.push({ ...e, status: drifted ? "stale" : "active", now: nowValue });
        }
        gatherings=gatherings.map(g=>({...g,belongsTo:nextDayLabel(g)}));
        gatherings.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
        return { ...day, gatherings };
    });
    return { days: out, applied };
};
