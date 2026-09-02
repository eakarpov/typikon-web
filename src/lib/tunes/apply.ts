// Раскладка напева на текст: какое колено какой строкой напева поётся и какой
// слог каким её шагом.
//
// Считается один раз и для всех нотаций сразу — потому строение и лежит на
// напеве, а не на записи (см. types.ts). Крюковая и линейная записи получают
// одну и ту же раскладку и не могут разойтись в делении текста.
//
// Правило раскладки — то, по которому обиход и поётся: колено делится на
// РАСПЕВНЫЕ ГРУППЫ (обиход помечает их начала стрелками), каждая группа садится
// на своё ударение, а читок внутри группы принимает всё, что осталось. Поэтому
// «Го́споди, воззва́хъ» и «Услы́ши мя, Го́споди» ложатся на один напев, хотя длина
// у них разная: растягивается читок, а распевы стоят на ударениях.
//
// Этажом выше работает не то же правило, а своё: колена разбираются по строкам
// в том порядке, какой книга печатает под схемой («1, 3, ‖: 1, 2, 3 :‖ закл.»),
// и повторяется круг. Считает раздачу orderLines().

import type { Colon } from "./syllables";
import type { LineOrder, LineVariant, Step, Tune, TuneLine } from "./types";

export interface Cell {
    syllable: string;
    stressed: boolean;
    wordStart: boolean;
    /** Номер шага в строке напева; по нему запись достаёт своё содержание. */
    step: number;
    /** Шаг тянется на этом слоге дальше: слогов оказалось больше, чем шагов. */
    held: boolean;
    /** Слог пришёлся на речитатив. */
    flex: boolean;
}

export interface FittedColon {
    /** Номер строки напева, которой поётся это колено. */
    line: number;
    /** Ключ варианта строки, если выбран: по нему запись берёт своё содержание. */
    variant: string | null;
    cells: Cell[];
    trailing: string;
    /** Сколько шагов строки осталось непропетыми: текст короче напева. */
    unused: number;
}

export interface Fitted {
    colons: FittedColon[];
    /**
     * Что не сошлось. Не прячем и не подгоняем: напевы правятся руками, и
     * несовпадение — это сообщение правщику, а молча съеденный слог — нет.
     */
    issues: string[];
}

const plural = (n: number, one: string, few: string, many: string) => {
    const tail = n % 10, hundred = n % 100;
    if (tail === 1 && hundred !== 11) return one;
    if (tail >= 2 && tail <= 4 && (hundred < 12 || hundred > 14)) return few;
    return many;
};

const stepWord = (n: number) => plural(n, "шаг", "шага", "шагов");
const syllableWord = (n: number) => plural(n, "слог", "слога", "слогов");
const lineWord = (n: number) => plural(n, "строка", "строки", "строк");
const colonWord = (n: number) => plural(n, "колено", "колена", "колен");

/**
 * Раздача колен по строкам напева — по порядку, объявленному напевом.
 *
 * Хвост считается ОТ КОНЦА, а зачин от начала, и делается это именно в таком
 * порядке: когда колен меньше, чем строк, песнопение обязано кончиться
 * заключительной строкой, а начаться особым образом — нет.
 *
 * Пустой круг означает напев фиксированной длины (подобен). Лишние колена тогда
 * достаются последней строке зачина: петь их всё равно чем-то надо, но об этом
 * говорится вслух — см. assignLines.
 */
export const orderLines = (colons: number, order: LineOrder): number[] => {
    const out: number[] = new Array(colons).fill(0);
    const { head, cycle, tail } = order;

    const fromTail = Math.min(tail.length, colons);
    for (let i = 0; i < fromTail; i++) {
        out[colons - fromTail + i] = tail[tail.length - fromTail + i];
    }

    const left = colons - fromTail;
    const fromHead = Math.min(head.length, left);
    for (let i = 0; i < fromHead; i++) out[i] = head[i];

    const middle = left - fromHead;
    const fallback = head[head.length - 1] ?? tail[0] ?? 0;
    for (let i = 0; i < middle; i++) {
        out[fromHead + i] = cycle.length ? cycle[i % cycle.length] : fallback;
    }

    return out;
};

/**
 * Отрезок строки: предраспев или распевная группа.
 *
 * Группу начинает шаг с распевом; всё до первого распева — предраспев. Отрезок
 * знает, каким шагом строки он начинается (offset), где внутри него читок и
 * распев, и — после раздачи — на какие слоги он лёг.
 */
interface Segment {
    offset: number;
    steps: Step[];
    /** Номер шага-распева внутри отрезка; −1 у предраспева. */
    anchorAt: number;
    kind: "first" | "last" | null;
    /** Номер читка внутри отрезка; −1, если его нет. */
    flexAt: number;
    /** Слог, на который сел распев; −1, пока не сел. */
    anchor: number;
    start: number;
    end: number;
}

/**
 * Деление шагов на отрезки: предраспев и распевные группы.
 *
 * Отдана наружу ради проверки данных (registry.ts): проверять строение надо
 * ровно тем же делением, каким оно потом раскладывается, иначе проверка и
 * раскладка разойдутся в понимании того, где кончается группа.
 */
export const groupsOf = (steps: Step[]): Step[][] =>
    segmentsOf(steps).map(segment => segment.steps);

const segmentsOf = (steps: Step[]): Segment[] => {
    const out: Segment[] = [];
    let from = 0;
    const push = (to: number) => {
        const own = steps.slice(from, to);
        if (!own.length) return;
        const anchorAt = own.findIndex(s => s.stress);
        out.push({
            offset: from, steps: own, anchorAt,
            kind: anchorAt < 0 ? null : own[anchorAt].stress!,
            flexAt: own.findIndex(s => s.flex),
            anchor: -1, start: 0, end: -1,
        });
        from = to;
    };
    steps.forEach((step, i) => { if (step.stress && i > from) push(i); });
    push(steps.length);
    return out;
};

/**
 * Куда сели распевы.
 *
 * Группы с распевом «first» разбираются СЛЕВА, с «last» — СПРАВА, и один
 * ударный слог достаётся только одной группе. Так у заключительного колена
 * третьего гласа обе группы «last» садятся на два последних ударения —
 * «ве́лию» и «ми́лость», — а не спорят за одно.
 */
const placeAnchors = (segments: Segment[], stressed: number[], n: number) => {
    const taken = new Set<number>();

    // Сколько слогов отрезок обязан занять до распева и после: читок
    // растяжим и в счёт не идёт, остальные шаги требуют по слогу.
    const room = (segment: Segment) => {
        const fixed = (from: number, to: number) =>
            segment.steps.slice(from, to).filter(s => !s.flex).length;
        return {
            before: fixed(0, segment.anchorAt),
            after: fixed(segment.anchorAt + 1, segment.steps.length),
        };
    };

    const next = (segment: Segment, from: "left" | "right", after: number, before: number) => {
        const { before: pre, after: post } = room(segment);
        // Распев не может сесть так поздно, чтобы шагам после него не осталось
        // слогов, — и так рано, чтобы не осталось шагам до него.
        //
        // Это не подгонка: «Пе́рвенец ме́ртвых бы́сть» кончается ударным
        // односложным словом, и распев, севший на последнее ударение вообще,
        // отнял бы слог у исхода. Книга поёт его на «ме́ртвых» — то есть на
        // последнем ударении, ПОСЛЕ которого напев ещё умещается.
        const free = stressed.filter(i => !taken.has(i) && i > after && i < before);
        const roomy = free.filter(i => i - pre >= 0 && i + post <= n - 1);
        // Требование места — предпочтение, а не запрет: у колена может не быть
        // другого ударения вовсе («возопи́м»), и тогда распев садится на него, а
        // лишние шаги остаются непропетыми — это видно в unused.
        const fit = roomy.length ? roomy : free;
        const at = from === "left" ? fit[0] : fit[fit.length - 1];
        if (at === undefined) return -1;
        taken.add(at);
        return at;
    };

    let after = -1;
    for (const segment of segments) {
        if (segment.kind !== "first") continue;
        segment.anchor = next(segment, "left", after, Infinity);
        if (segment.anchor >= 0) after = segment.anchor;
    }

    let before = Infinity;
    for (const segment of [...segments].reverse()) {
        if (segment.kind !== "last") continue;
        segment.anchor = next(segment, "right", after, before);
        if (segment.anchor >= 0) before = segment.anchor;
    }
};

/**
 * Границы отрезков.
 *
 * Отрезок держится за свой распев: если читок стоит ПОСЛЕ распева, начало
 * отрезка известно точно (распев минус то, что перед ним), и растягивается он
 * вправо; если ДО — известен конец, и растягивается влево.
 *
 * Концы берутся от начала следующего отрезка, а не считаются отдельно, и это
 * не мелочь: колено делится нацело, и всякий зазор между отрезками означал бы
 * молча потерянные слоги. Лишние слоги достаются последнему шагу отрезка — он
 * тянется, как и положено остановке перед следующим распевом.
 */
const placeBounds = (segments: Segment[], n: number) => {
    const startAt: (number | null)[] = [];
    const endAt: (number | null)[] = [];

    for (const { anchorAt, flexAt, anchor, steps } of segments) {
        if (anchor < 0) { startAt.push(null); endAt.push(null); continue; }
        startAt.push(flexAt >= 0 && flexAt < anchorAt ? null : anchor - anchorAt);
        // Читок НА самом распеве (остановка) тянется вправо: ударный слог он
        // занимает обязательно, а повторы набегают после него.
        endAt.push(flexAt >= anchorAt && flexAt >= 0 ? null : anchor + (steps.length - 1 - anchorAt));
    }

    segments.forEach((segment, i) => {
        const floor = i === 0 ? 0 : segments[i - 1].start + 1;
        // Начало неизвестно — берём от конца соседа, а его нет, так по числу
        // его же шагов: отрезок без распева иначе не к чему привязать.
        const guess = startAt[i]
            ?? (i === 0 ? 0 : (endAt[i - 1] !== null
                ? endAt[i - 1]! + 1
                : segments[i - 1].start + segments[i - 1].steps.length));
        segment.start = Math.max(floor, Math.min(guess, n - 1));
    });

    segments.forEach((segment, i) => {
        segment.end = i === segments.length - 1 ? n - 1 : segments[i + 1].start - 1;
    });
};

/**
 * Раскладка одного колена.
 *
 * Колено делится на РАСПЕВНЫЕ ГРУППЫ, каждая садится на своё ударение, а читок
 * внутри группы принимает всё, что осталось. Поэтому «Го́споди, воззва́хъ» и
 * «Услы́ши мя, Го́споди» ложатся на один напев: растягивается читок, а распевы
 * стоят там, где стоят ударения.
 *
 * Без читка мелодия ФИКСИРОВАНА по длине — так устроены строки подобна. Тогда
 * требуем совпадения числом и говорим прямо, если оно не сошлось: подгонять
 * подобен под чужую длину нельзя, он этим и подобен.
 */
export const fitColon = (
    line: TuneLine,
    colon: Colon,
    lineIndex: number,
    at: number,
    issues: string[],
    variant: string | null = null,
): FittedColon => {
    const steps = line.steps;
    const syllables = colon.syllables;
    const n = syllables.length;
    const cell = (i: number, step: number, held = false, flex = false): Cell => ({
        syllable: syllables[i].text,
        stressed: syllables[i].stressed,
        wordStart: syllables[i].wordStart,
        step, held, flex,
    });

    const fixed = !steps.some(s => s.flex);
    if (fixed) {
        const cells = syllables.map((_, i) => cell(i, Math.min(i, steps.length - 1), i >= steps.length));
        if (n !== steps.length) {
            issues.push(
                `колено ${at + 1}: в напеве ${steps.length} ${stepWord(steps.length)}, ` +
                `в тексте ${n} ${syllableWord(n)}`,
            );
        }
        return {
            line: lineIndex, variant, cells, trailing: colon.trailing,
            unused: Math.max(0, steps.length - n),
        };
    }

    const stressed = syllables.flatMap((s, i) => (s.stressed ? [i] : []));
    if (!stressed.length) {
        issues.push(`колено ${at + 1}: ударного слога нет — распевы положены по краям строки`);
    }
    if (n < steps.length - 1) {
        issues.push(
            `колено ${at + 1}: слогов ${n}, а напеву нужно не меньше ${steps.length - 1} — ` +
            `распев укорочен`,
        );
    }

    const segments = segmentsOf(steps);
    placeAnchors(segments, stressed, n);
    placeBounds(segments, n);

    const cells: Cell[] = [];
    let unused = 0;

    for (const segment of segments) {
        const { steps: own, flexAt, offset } = segment;
        const head = flexAt < 0 ? own : own.slice(0, flexAt);
        const tail = flexAt < 0 ? [] : own.slice(flexAt + 1);
        const m = segment.end - segment.start + 1;
        if (m <= 0) { unused += own.length; continue; }

        // Без читка отрезок не растягивается: за его шагами сразу начинается
        // область, где последний шаг тянется на лишние слоги.
        const tailStart = flexAt < 0 ? head.length : Math.max(head.length, m - tail.length);
        for (let k = 0; k < m; k++) {
            const i = segment.start + k;
            if (k < head.length) {
                cells.push(cell(i, offset + Math.min(k, own.length - 1), k >= own.length));
            } else if (k < tailStart) {
                cells.push(cell(i, offset + flexAt, k > head.length, true));
            } else {
                const inTail = k - tailStart;
                cells.push(inTail < tail.length
                    ? cell(i, offset + flexAt + 1 + inTail)
                    : cell(i, offset + own.length - 1, true));
            }
        }
        unused += Math.max(0, head.length + tail.length - m);
    }

    return { line: lineIndex, variant, cells, trailing: colon.trailing, unused };
};

/**
 * Раздача колен по строкам этого напева.
 *
 * У гласового напева круг повторяется, и стихира любой длины ложится на него
 * без остатка. У подобна круга нет: колен в нём столько же, сколько строк, и
 * всякое расхождение — это либо текст не того подобна, либо ошибка разбора
 * книги. И то и другое надо показать, а не сгладить.
 */
export const assignLines = (colons: number, tune: Tune, issues: string[]): number[] => {
    const { head, cycle, tail } = tune.order;
    const fixed = head.length + tail.length;

    if (!cycle.length && colons !== fixed) {
        issues.push(
            `в напеве ${fixed} ${lineWord(fixed)}, в тексте ${colons} ${colonWord(colons)}`,
        );
    } else if (colons < fixed) {
        issues.push(
            `колен ${colons}, а напеву нужно не меньше ${fixed} — ` +
            `${colons < tail.length ? "исход укорочен" : "зачин укорочен"}`,
        );
    }

    return orderLines(colons, tune.order);
};

/**
 * Выбранные варианты строк: ключ строки -> вариант.
 *
 * Молча берём первый подходящий и не спорим с невнятным выбором: варианты
 * приходят из адреса страницы, и незнакомый ключ там значит опечатку или
 * старую ссылку, а не повод не показать напев.
 */
const variantsFor = (tune: Tune, chosen: string[]): Map<number, LineVariant> => {
    const out = new Map<number, LineVariant>();
    for (const key of chosen) {
        const variant = tune.variants?.find(v => v.id === key);
        if (variant && !out.has(variant.line)) out.set(variant.line, variant);
    }
    return out;
};

export const fitTune = (tune: Tune, colons: Colon[], chosen: string[] = []): Fitted => {
    const issues: string[] = [];
    const lines = assignLines(colons.length, tune, issues);
    const variants = variantsFor(tune, chosen);

    const out = colons.map((colon, i) => {
        const variant = variants.get(lines[i]) ?? null;
        return fitColon(
            variant ?? tune.lines[lines[i]], colon, lines[i], i, issues, variant?.id ?? null,
        );
    });
    return { colons: out, issues };
};
