// Из стояний устава — в собрания прихода.
//
// Стояние говорит, в какую половину каких суток служба СТОИТ по уставу.
// Собрание — во сколько за нею приходят и что при этом служится. Первое
// уставно и одинаково везде; второе принадлежит приходу целиком.
//
// Порядок работы: сперва разложить службы по местам (устав, потом приходские
// переносы и отмены), затем сгруппировать по половинам суток и уже группе
// назначить час и заголовок. Иначе не выйдет: перенос утрени на вечер меняет
// СОСТАВ вечернего собрания, и назначать ему имя до переноса было бы рано.

import type { OrdoDay, OrdoVariant } from "@/lib/ordo";
import { isDvunadesyaty, isPrestolny } from "./engine";
import { resolveRules } from "./rules";
import {
    PART_LABELS, PART_ORDER,
    type DayContext, type Gathering, type GatheringService, type GatheringSpec,
    type ParishDay, type ParishSettings, type Part, type WhyStep,
} from "./types";

/** Подписи своим службам, которых в уставе нет. */
export const OWN_LABELS: Record<string, string> = {
    moleben: "Молебен",
    panihida: "Панихида",
    soborovanie: "Соборование",
    venchanie: "Венчание",
    ispoved: "Исповедь",
    "krestny-hod": "Крестный ход",
    "vodosvyatny-moleben": "Водосвятный молебен",
    akafist: "Акафист",
};

// Порядок круга суток: им же расставлены службы и в движке. Заголовок читается
// сверху вниз по этому порядку, а не по тому, как службы легли в список.
const CIRCLE = ["vespers-small", "vespers", "vsenoshchnoe", "compline", "midnight",
    "matins", "hour-1", "hour-3", "hour-6", "hour-9", "hours", "izobrazitelny",
    "liturgy"];

// Службы, которых на стенде не объявляют: за ними не приходят особо, они идут
// вместе с той, что рядом. Часы читаются перед литургией, изобразительны —
// после часов; объявляют «Литургию», и все понимают.
const SILENT = new Set(["hour-1", "hour-3", "hour-6", "hour-9", "hours"]);
const SILENT_WITH_LITURGY = new Set(["izobrazitelny"]);

const shift = (date: string, days: number) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};

const slugOf = (services: GatheringService[]) =>
    services.map(s => s.key).join("-").replace(/[^a-z0-9-]/gi, "") || "sobranie";

const titleOf = (services: GatheringService[]): string => {
    const ustav = services.filter(s => !s.own);
    const own = services.filter(s => s.own);
    const hasLiturgy = ustav.some(s => s.key === "liturgy");
    let named = ustav.filter(s => !SILENT.has(s.key)
        && !(hasLiturgy && SILENT_WITH_LITURGY.has(s.key)));
    // где не осталось ничего объявляемого — часы и есть служба, и назвать их
    // надо: пустая строка расписания хуже неловкой
    if (!named.length) named = ustav.slice(0, 1);
    return [...named, ...own].map(s => s.label).join(". ") || "Служба";
};

// ЛИТУРГИЯ В СЛОТЕ ВЕЧЕРНИ ЗОВЁТСЯ ЛИТУРГИЕЙ. Устав ставит Преждеосвященную,
// Василия Великого и Благовещенскую в слот вечерни — так они и служатся, с
// вечерней впереди, — но ключ у слота остаётся «vespers», и на стенде вышло бы
// «Вечерня» там, где приход придёт на Литургию. Имя берётся у канвы, потому
// что именно она и говорит, что это за служба.
const BY_ORDO: [string, string][] = [
    ["liturgy-presanctified", "Литургия Преждеосвященных Даров"],
    ["liturgy-basil", "Литургия Василия Великого"],
    ["liturgy-chrysostom", "Литургия"],
];

const labelOf = (key: string, label: string, ordoId?: string | null): string => {
    if (key === "vespers" && ordoId) {
        const hit = BY_ORDO.find(([suffix]) => ordoId.endsWith(suffix));
        if (hit) return hit[1];
    }
    return label;
};

const serviceOf = (key: string, label?: string | null, ordoId?: string | null): GatheringService =>
    label ? { key, label: labelOf(key, label, ordoId) }
          : { key, label: OWN_LABELS[key] ?? key, own: true };

/** Одна служба, поставленная на своё место. */
interface Placed {
    civil: string;
    part: Part;
    service: GatheringService;
    /** Церковный день, которому служба принадлежит. */
    ownerDate: string;
    ownerLabel: string;
    order: number;
    why: WhyStep[];
}

const placeDay = (ctx: DayContext, settings: ParishSettings): Placed[] => {
    const { day, variant } = ctx;
    const out: Placed[] = [];
    const ownerLabel = day.triodLabel ?? day.memories[0]?.label ?? variant.label;

    for (const stoyanie of variant.stoyaniya) {
        const resolved = resolveRules(settings.rules, { ...ctx, stoyanie });

        // 1. ЧТО ПРИХОД НЕ СЛУЖИТ. По порядку, а не объединением: правила
        //    отсортированы по возрастанию точности, и «постом повечерие
        //    возвращается» обязано перебить общее «повечерия не служим».
        const dropped = new Set<string>();
        for (const r of resolved.applied) {
            for (const k of r.then.drop ?? []) dropped.add(k);
            for (const k of r.then.keep ?? []) dropped.delete(k);
        }

        // 2. РАЗВИЛКА «бдение или порознь». Где устав назначил бдение, вечерня
        //    с утреней в него вошли, но из списка не убраны: «идеже всенощных
        //    не бывает» книга допускает прямо (гл. 7), и выбор не наш.
        const chosen = new Set(resolved.applied.flatMap(r => r.then.choose ?? []));
        const subsumed = new Set(stoyanie.services.map(s => s.replacedBy).filter(Boolean) as string[]);

        const kept = stoyanie.services.filter(s => {
            if (dropped.has(s.key)) return false;
            if (s.replacedBy) return chosen.has(s.key) && !chosen.has(s.replacedBy);
            if (subsumed.has(s.key)) return chosen.size === 0 || chosen.has(s.key);
            return true;
        });

        // 3. ПРИХОДСКИЕ ПЕРЕНОСЫ
        // Переносы — тем же порядком, что и всё прочее: правила отсортированы
        // по возрастанию точности, и берётся ПОСЛЕДНИЙ подошедший. Оттого
        // великопостное «утреня остаётся утром» и перебивает общее «утреня
        // служится вечером накануне», а не спорит с ним.
        const moves = resolved.applied.flatMap(r =>
            (r.then.move ?? []).map(m => ({ ...m, rule: r })));
        const moveFor = (key: string) => {
            let found: typeof moves[number] | undefined;
            for (const m of moves) if (m.services.includes(key)) found = m;
            return found;
        };

        const why: WhyStep[] = [
            ...stoyanie.why.map(text => ({ kind: "stoyanie" as const, text })),
            ...resolved.why,
        ];

        for (const s of kept) {
            const m = moveFor(s.key);
            const civil = m ? shift(stoyanie.civil, m.dayOffset ?? 0) : stoyanie.civil;
            const part = m ? m.to : (stoyanie.part as Part);
            out.push({
                civil, part, ownerDate: day.date, ownerLabel,
                order: CIRCLE.indexOf(s.key) < 0 ? 99 : CIRCLE.indexOf(s.key),
                service: serviceOf(s.key, s.label, s.ordoId),
                why: m
                    ? [...why, {
                        kind: "parish", ruleKey: m.rule.key,
                        text: m.note ?? `${m.rule.label}: служится не тогда, когда `
                            + `ставит устав, а ${PART_LABELS[m.to]}`,
                    }]
                    : why,
            });
        }

        // 4. СВОЁ, безымянное: входит в это же собрание — за молебном по
        //    литургии не приходят особо
        for (const r of resolved.applied) {
            for (const a of r.then.add ?? []) {
                if (a.title || a.part !== stoyanie.part) continue;
                for (const k of a.services ?? []) {
                    // отмена сильнее добавки: правило Страстной убирает
                    // субботнюю панихиду, не отменяя самого правила о субботах
                    if (dropped.has(k)) continue;
                    // …и перенос её тоже касается: крестный ход пасхальной
                    // ночи обязан уехать вместе с самою ночью, иначе останется
                    // стоять один в опустевшем стоянии и заведёт лишнюю строку
                    const m = moveFor(k);
                    out.push({
                        civil: shift(m ? shift(stoyanie.civil, m.dayOffset ?? 0)
                                       : stoyanie.civil, m ? 0 : (a.dayOffset ?? 0)),
                        part: m ? m.to : a.part,
                        ownerDate: day.date, ownerLabel, order: 100,
                        service: serviceOf(k),
                        why: [{ kind: "parish", ruleKey: r.key,
                                text: r.note ? `${r.label}: ${r.note}` : r.label }],
                    });
                }
            }
        }
    }

    // 5. СОБСТВЕННЫЕ СОБРАНИЯ прихода — те, за которыми приходят особо
    const dayLevel = resolveRules(settings.rules, ctx);
    for (const r of dayLevel.applied) {
        for (const a of r.then.add ?? []) {
            if (!a.title) continue;
            for (const [i, k] of (a.services ?? []).entries()) {
                out.push({
                    civil: shift(day.date, a.dayOffset ?? 0), part: a.part,
                    ownerDate: day.date, ownerLabel, order: 200 + i,
                    service: serviceOf(k),
                    why: [{ kind: "parish", ruleKey: r.key,
                            text: r.note ? `${r.label}: ${r.note}` : r.label }],
                });
            }
        }
    }
    return out;
};

/** Час, заголовок и деление собрания — по самому точному из правил. */
const dressGathering = (
    placed: Placed[],
    civil: string,
    part: Part,
    ctxOf: (date: string) => DayContext | undefined,
    settings: ParishSettings,
    rowDate: string,
): Gathering[] => {
    const services = placed
        .slice()
        .sort((a, b) => a.order - b.order)
        .map(p => p.service)
        .filter((s, i, all) => all.findIndex(x => x.key === s.key) === i);
    if (!services.length) return [];

    const ctx = ctxOf(placed[0].ownerDate);
    const resolved = ctx
        ? resolveRules(settings.rules, {
            ...ctx,
            stoyanie: ctx.variant.stoyaniya.find(s => s.part === part)
                ?? { key: "", civil, part, partLabel: PART_LABELS[part], services: [], why: [] },
        })
        : { applied: [], why: [], ties: [] };

    let time: string | null = null;
    let title: string | null = null;
    let duration: number | null = null;
    let split: GatheringSpec[] | null = null;
    for (const r of resolved.applied) {
        const set = r.then.set;
        if (set?.part === part) {
            if (set.time) time = set.time;
            if (set.title) title = set.title;
            if (set.duration) duration = set.duration;
        }
        // ЦЕЛЫЙ СОСТАВ, заданный правилом, отменяет прежний, а не дополняет:
        // «в двунадесятые две литургии» — не поправка часа, а другой день
        const own = (r.then.gatherings ?? []).filter(g => g.part === part);
        if (own.length) split = own;
    }

    // ЧЕЙ ЭТО ДЕНЬ. Вечернее богослужение стоит в строке предыдущего числа, и
    // без подписи читающий отнесёт его к чужому празднику — той самой памяти,
    // что напечатана в строке слева.
    const owner = placed[0];
    const belongs = owner.ownerDate !== rowDate ? owner.ownerLabel : null;

    const why = placed.flatMap(p => p.why)
        .filter((w, i, all) => all.findIndex(x => x.text === w.text) === i);

    const at = (spec: GatheringSpec | null, i: number): Gathering => {
        const svc = spec?.services?.length
            ? spec.services.map(k => serviceOf(k, services.find(x => x.key === k)?.label))
            : services;
        return {
            key: `${civil}:${part}:${slugOf(svc)}${i ? `:${i}` : ""}`,
            civil, part, partLabel: PART_LABELS[part],
            time: spec?.time ?? time,
            title: spec?.title ?? title ?? titleOf(svc),
            belongsTo: belongs,
            duration: spec?.duration ?? duration,
            services: svc,
            why,
        };
    };
    return split ? split.map((g, i) => at(g, i)) : [at(null, 0)];
};

/**
 * Расписание месяца.
 *
 * Строка расписания — ГРАЖДАНСКИЙ день, а не церковный: на стенде висит
 * календарь, и человек ищет в нём «пятое сентября», а не «неделю двенадцатую
 * по Пятидесятнице». Оттого вечернее богослужение шестого числа и попадает в
 * строку пятого — туда, куда за ним придут, — но подписывается своим днём.
 *
 * `days` должен нести и первое число следующего месяца: его вечернее стояние
 * ложится на вечер последнего числа этого.
 */
export const buildMonth = (
    days: Map<string, OrdoDay>,
    settings: ParishSettings,
    inMonth: (date: string) => boolean,
): ParishDay[] => {
    const contexts = new Map<string, DayContext>();
    const placed: Placed[] = [];

    for (const day of days.values()) {
        const variant = day.variants[0];
        if (!variant) continue;
        const ctx: DayContext = {
            day, variant,
            dvunadesyaty: isDvunadesyaty(day, variant),
            prestolny: isPrestolny(variant),
        };
        contexts.set(day.date, ctx);
        placed.push(...placeDay(ctx, settings));
    }

    const groups = new Map<string, Placed[]>();
    for (const p of placed) {
        if (!inMonth(p.civil)) continue;
        const k = `${p.civil}:${p.part}`;
        const g = groups.get(k);
        if (g) g.push(p); else groups.set(k, [p]);
    }

    const out: ParishDay[] = [];
    for (const date of [...days.keys()].filter(inMonth).sort()) {
        const ctx = contexts.get(date);
        if (!ctx) continue;
        const { day, variant } = ctx;

        const gatherings: Gathering[] = [];
        for (const part of Object.keys(PART_ORDER) as Part[]) {
            const g = groups.get(`${date}:${part}`);
            if (g?.length) {
                gatherings.push(...dressGathering(
                    g, date, part, d => contexts.get(d), settings, date));
            }
        }
        // ПО ЧАСАМ, А НЕ ПО КРУГУ СУТОК. Круг начинается вечером, и по нему
        // вечернее собрание идёт первым — так оно и лежит в движке. Но на
        // стенде висит гражданский календарь, и читают его от утра к ночи:
        // строка «17:00, 8:00, 9:00» заставляет читателя спотыкаться о то, что
        // ему знать незачем. Час без времени уходит в конец, к своему кругу.
        gatherings.sort((a, b) =>
            (a.time ?? "99:99").localeCompare(b.time ?? "99:99")
            || PART_ORDER[a.part] - PART_ORDER[b.part]);

        out.push({
            date,
            weekdayLabel: day.weekdayLabel,
            label: variant.label,
            sign: variant.sign,
            triodLabel: day.triodLabel,
            memories: day.memories.map(m => ({ memoryId: m.memoryId, label: m.label })),
            fastingLabel: variant.fastingLabel,
            prestolny: ctx.prestolny
                ? (variant.hram?.title as string | undefined) ?? "престольный праздник"
                : null,
            dvunadesyaty: ctx.dvunadesyaty,
            tone: day.tone,
            gatherings,
        });
    }
    return out;
};
