// Разрешение приходских правил — по ТОЧНОСТИ, а не «последнее победило».
//
// Так устроен и сам устав: слои просматриваются сверху вниз, и знак сильнее
// дня недели, а праздник сильнее знака. Правило «в двунадесятые две литургии»
// должно перебивать правило «в воскресенье литургия в девять» независимо от
// того, какое из них записали раньше, — иначе порядок ввода становится
// скрытым смыслом, и ответственный, добавив правило, молча ломает соседнее.

import type { DayContext, ParishCondition, ParishRule, WhyStep } from "./types";

/**
 * Веса полей условия. Не «сколько полей названо», а НАСКОЛЬКО УЗКО каждое:
 * конкретная дата задаёт один день в году, день недели — пятьдесят два.
 * Считать их поровну значило бы сказать, что «по средам» так же точно, как
 * «двенадцатого апреля».
 */
const WEIGHTS: Record<keyof ParishCondition, number> = {
    date: 800,            // «04-12» — это число всякий год
    paschaOffset: 900,
    prestolny: 700,
    dvunadesyaty: 600,
    sign: 500,
    feast: 400,
    triod: 300,
    dayVariant: 200,
    weekday: 100,
    hasService: 50,
    part: 50,
};

/** Полная дата — один день на всю историю, и точнее неё нет ничего. */
const FULL_DATE = 1000;

export const specificity = (when: ParishCondition): number => {
    let sum = 0;
    for (const [k, v] of Object.entries(when)) {
        if (v === undefined || v === null) continue;
        if (Array.isArray(v) && v.length === 0) continue;
        sum += k === "date" && String(v).length === 10
            ? FULL_DATE
            : WEIGHTS[k as keyof ParishCondition] ?? 10;
    }
    return sum;
};

const has = (list: string[] | undefined, value: string | null | undefined) =>
    !list || list.length === 0 || (value != null && list.includes(value));

export const matches = (when: ParishCondition, ctx: DayContext): boolean => {
    const { day, variant, stoyanie } = ctx;

    if (when.date) {
        const d = day.date;                       // «2026-04-12»
        const ok = when.date.length === 10 ? d === when.date : d.slice(5) === when.date;
        if (!ok) return false;
    }
    if (when.paschaOffset !== undefined && day.paschaOffset !== when.paschaOffset) return false;
    if (!has(when.weekday, day.weekday)) return false;
    if (!has(when.dayVariant, variant.dayVariant)) return false;
    if (!has(when.sign, variant.sign)) return false;
    if (!has(when.feast, variant.feast)) return false;
    if (!has(when.triod, day.triod)) return false;
    if (when.dvunadesyaty !== undefined && ctx.dvunadesyaty !== when.dvunadesyaty) return false;
    if (when.prestolny !== undefined && ctx.prestolny !== when.prestolny) return false;
    if (when.part && stoyanie?.part !== when.part) return false;
    if (when.hasService?.length) {
        // спрашивается про ЭТО стояние, если оно названо, иначе про весь день
        const keys = new Set((stoyanie?.services ?? variant.services).map(s => s.key));
        if (!when.hasService.some(k => keys.has(k))) return false;
    }
    return true;
};

export interface Resolved {
    applied: ParishRule[];
    why: WhyStep[];
    /** Правила, разошедшиеся по приоритету при равной точности. */
    ties: [ParishRule, ParishRule][];
}

/**
 * Все подошедшие правила — ПО ВОЗРАСТАНИЮ точности: общее ложится первым,
 * точное правит поверх. Возвращаются именно все, а не победившее: правила не
 * взаимоисключающи (одно роняет повечерие, другое ставит час), и выбрать из
 * них одно значило бы потерять остальные.
 */
export const resolveRules = (rules: ParishRule[], ctx: DayContext): Resolved => {
    const applied = rules
        // выключенное приходом не применяется, но и не стирается: вернуть его
        // должно быть чем
        .filter(r => r.enabled !== false)
        .filter(r => matches(r.when, ctx))
        .sort((a, b) => specificity(a.when) - specificity(b.when)
            || (a.priority ?? 0) - (b.priority ?? 0)
            || a.key.localeCompare(b.key));

    // НИЧЬЯ ПОКАЗЫВАЕТСЯ, А НЕ РАЗРЕШАЕТСЯ МОЛЧА. Два правила равной точности,
    // говорящие о разном часе, — это не тонкость движка, а ошибка ответственного,
    // и он должен её увидеть, а не гадать, отчего расписание странное.
    const ties: [ParishRule, ParishRule][] = [];
    for (let i = 1; i < applied.length; i++) {
        const [a, b] = [applied[i - 1], applied[i]];
        if (specificity(a.when) === specificity(b.when)
            && (a.then.set?.time || a.then.gatherings) && (b.then.set?.time || b.then.gatherings)) {
            ties.push([a, b]);
        }
    }

    const why: WhyStep[] = applied.map(r => ({
        kind: "rule",
        ruleKey: r.key,
        text: r.note ? `${r.label}: ${r.note}` : r.label,
    }));
    for (const [a, b] of ties) {
        why.push({
            kind: "rule",
            text: `два правила равной точности разошлись по приоритету: `
                + `«${a.label}» и «${b.label}» — сильнее оказалось второе`,
        });
    }
    return { applied, why, ties };
};
