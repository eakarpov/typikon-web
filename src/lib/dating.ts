// Датировка записи перебором: какой год ей отвечает и цела ли она вообще.
//
// Средневековая запись датирует себя не числом, а НАБОРОМ чисел: «в лето 6712,
// индикта третьяго, месяца марта в 5 день, в неделю». Каждое по себе широко —
// индикт повторяется каждые пятнадцать лет, день недели каждые семь, — а
// вместе они сходятся в точку.
//
// ПОЧЕМУ ПЕРЕБОР ЗАКОНЧЕН, А НЕ ПРИБЛИЗИТЕЛЕН. Круги замыкаются: индикт через
// 15 лет, круг Солнцу через 28, круг Луне через 19. Вместе — 7980 лет, дольше
// всей письменной истории. Запись, назвавшая все три, указывает на один
// единственный год, и это свойство чисел, а не догадка.
//
// ТРИ ОТВЕТА, А НЕ ОДИН: один год — сошлось; несколько — запись недоопределена
// (ответ о ЗАПИСИ, а не наша неудача); ни одного — запись противоречит себе, и
// вот тут начинается работа: выбрасывание условий по одному показывает, какое
// чтение её чинит.
//
// Считающая часть — @/utils/chronology; здесь только перебор.
import * as ch from "@/utils/chronology";

export type Field =
    | "indikt" | "krugSolntsu" | "krugLune" | "vrutseleto"
    | "osnovanie" | "epakta" | "klyuchGranits" | "weekday";

export interface Record_ {
    leto?: number;
    style?: ch.EraStyle;
    month?: number;   // юлианского счёта — то, что напечатано в источнике
    day?: number;
    indikt?: number;
    krugSolntsu?: number;
    krugLune?: number;
    vrutseleto?: number;
    osnovanie?: number;
    epakta?: number;
    klyuchGranits?: string;
    weekday?: ch.Weekday;
}

export const FIELD_LABELS: Record<Field, string> = {
    indikt: "индикт",
    krugSolntsu: "круг Солнцу",
    krugLune: "круг Луне",
    vrutseleto: "вруцелето",
    osnovanie: "основание",
    epakta: "эпакта",
    klyuchGranits: "ключ границ",
    weekday: "день недели",
};

// Порядок отсева — он же порядок строк в решете на странице: сперва числа
// года, потом день недели, который проверяется уже по найденному дню.
export const FIELDS: Field[] = [
    "indikt", "krugSolntsu", "krugLune", "vrutseleto",
    "osnovanie", "epakta", "klyuchGranits", "weekday",
];

// Длина круга у каждой величины: ею меряется, НАСКОЛЬКО пришлось бы поправить
// запись. У чисел, ходящих по кругу, 1 и 15 соседи, а не края.
const CYCLES: Partial<Record<Field, number>> = {
    indikt: 15, krugSolntsu: 28, krugLune: 19,
    vrutseleto: 7, osnovanie: 30, epakta: 30,
};

/** Одно чтение лета: счёт эры и промежуток дней, в который оно его кладёт. */
export interface Reading {
    style: ch.EraStyle;
    span: ch.Span;
}

export interface Candidate {
    /**
     * Счета эры, которые дали ОДИН И ТОТ ЖЕ ответ и потому сведены в одного
     * кандидата. Пусто — лето не названо, и эре тут не за что зацепиться.
     *
     * Сводить приходится потому, что мартовский счёт с сентябрьским дают один
     * и тот же год круга ВСЕГДА: внутри обоих лежит одно и то же 1 марта.
     * Значит и все семь чисел года у них совпадают по определению, а
     * расходятся они только днём — и только когда число записи попало на
     * сентябрь–февраль. В остальных случаях показывать их порознь значит
     * выдавать одно чтение за два и подсовывать читателю мнимый выбор.
     */
    readings: Reading[];
    styles: ch.EraStyle[];
    leto: number | null;
    /** Промежуток первого чтения; у сведённых счёт по нему тот же. */
    span: ch.Span;
    marks: ch.YearMarks;
    /** День записи, если названы месяц и число. */
    jdn: number | null;
    label: string;
    /** Чем объяснить сведение нескольких счетов в одну строку. */
    note?: string;
    /** Условие -> сошлось ли. Нужно решету: показываем не только подошедших. */
    checks: Partial<Record<Field, boolean>>;
    /** Подошёл ли год под все условия записи. */
    fits: boolean;
    /**
     * На чём не сошлось — первое отвергнувшее условие ("date" значит, что
     * такого числа в этом году нет вовсе). Голого «не подошёл» мало: человек
     * читает решето, чтобы увидеть ПРИЧИНУ, а не приговор.
     */
    failedOn: Field | "date" | null;
}

/**
 * Лето книжного счёта для промежутка. Внутри всякого лета лежит ровно одно
 * 1 марта, и год круга — то, которое с него начинается: для мартовского лета
 * оно само, для сентябрьского — год, которым лето кончается, для
 * ультрамартовского — предыдущий, оттого он и обгоняет прочие на единицу.
 */
export const circleYear = (span: ch.Span): number => {
    const j = ch.jdnToJulian(span.first);
    const after = j.month > 3 || (j.month === 3 && j.day > 1);
    return j.year + 5508 + (after ? 1 : 0);
};

/**
 * День промежутка, у которого юлианские месяц и число — названные. В
 * промежутке длиной в год такой ровно один; ни одного — только если записано
 * 29 февраля невисокосного лета, и это само по себе улика.
 */
export const dateInSpan = (span: ch.Span, month: number, day: number): number | null => {
    const from = ch.jdnToJulian(span.first).year;
    for (const year of [from, from + 1]) {
        const jdn = ch.julianToJdn({ year, month, day });
        // Обратный ход ловит несуществующее число (31 июня, 29 февраля
        // невисокосного): нормализованная дата выйдет не той, что просили.
        const back = ch.jdnToJulian(jdn);
        if (back.month !== month || back.day !== day) continue;
        if (jdn >= span.first && jdn <= span.last) return jdn;
    }
    return null;
};

const actualValue = (field: Field, candidate: Candidate): number | string | null => {
    if (field === "weekday") {
        return candidate.jdn === null ? null : ch.weekdayOf(candidate.jdn);
    }
    if (field === "klyuchGranits") return candidate.marks.klyuchGranits;
    return candidate.marks[field as keyof ch.YearMarks] as number;
};

const blank = (span: ch.Span, jdn: number | null): Candidate => ({
    readings: [], styles: [], leto: null, span,
    marks: ch.yearMarks(circleYear(span)), jdn,
    label: "", checks: {}, fits: true, failedOn: null,
});

const candidatesFor = (record: Record_, firstAd: number, lastAd: number): Candidate[] => {
    const dayIn = (span: ch.Span) => record.month && record.day
        ? dateInSpan(span, record.month, record.day) : null;

    if (!record.leto) {
        const out: Candidate[] = [];
        for (let year = firstAd; year <= lastAd; year += 1) {
            const span = {
                first: ch.julianToJdn({ year, month: 3, day: 1 }),
                last: ch.julianToJdn({ year: year + 1, month: 3, day: 1 }) - 1,
            };
            const candidate = blank(span, dayIn(span));
            // Без лета кандидат — не эра, а год круга: тот, что идёт от 1 марта
            // до 1 марта. Подписать его «мартовским» нельзя — спутается со
            // счётом эры, который здесь как раз не назван.
            candidate.label = `год круга ${year}/${year + 1}`;
            out.push(candidate);
        }
        return out;
    }

    // Два счёта — один кандидат, если они дали и то же лето круга, и тот же
    // день. Ключ именно из этой пары: она и есть весь ответ, который чтение
    // способно дать перебору.
    const merged = new Map<string, Candidate>();
    for (const style of record.style ? [record.style] : ch.ERA_STYLES) {
        const span = ch.letoSpan(record.leto, style);
        const year = ch.jdnToGregorian(span.first).year;
        if (year < firstAd - 1 || year > lastAd + 1) continue;
        const jdn = dayIn(span);
        const key = `${circleYear(span)}|${jdn ?? "—"}`;
        const seen = merged.get(key);
        if (seen) {
            seen.readings.push({ style, span });
            seen.styles.push(style);
            continue;
        }
        const candidate = blank(span, jdn);
        candidate.leto = record.leto;
        candidate.readings.push({ style, span });
        candidate.styles.push(style);
        merged.set(key, candidate);
    }

    for (const candidate of merged.values()) {
        candidate.label = `${candidate.styles.map(s => ch.ERA_LABELS[s]).join(" и ")}`
            + ` ${candidate.leto}`;
        if (candidate.styles.length > 1) {
            candidate.note = candidate.jdn === null
                ? "эти счёта дают одно и то же лето круга — без числа месяца они неразличимы"
                : "на этом числе оба счёта дают один и тот же день";
        }
    }
    return [...merged.values()];
};

export interface Result {
    candidates: Candidate[];
    survivors: Candidate[];
    applied: Field[];
    /** Условие -> скольких кандидатов оно отсеяло (считая только первых павших). */
    killed: Partial<Record<Field, number>>;
    /** Скольких отсеяло само число месяца: такого дня в лете нет. */
    killedByDate: number;
    considered: number;
}

/**
 * Перебор. `skip` — какие условия не применять; на нём стоит diagnose().
 *
 * Кандидаты возвращаются ВСЕ, а не только выжившие: решето на странице
 * показывает и павших, иначе от него остаётся один ответ без вывода.
 */
export const solve = (
    record: Record_, firstAd: number, lastAd: number, skip: Field[] = [],
): Result => {
    const applied = FIELDS.filter(f => record[f] !== undefined && !skip.includes(f));
    const candidates = candidatesFor(record, firstAd, lastAd);
    const killed: Partial<Record<Field, number>> = {};
    let killedByDate = 0;

    for (const candidate of candidates) {
        if (record.month && record.day && candidate.jdn === null) {
            candidate.fits = false;
            candidate.failedOn = "date";
            killedByDate += 1;
            continue;
        }
        for (const field of applied) {
            const ok = actualValue(field, candidate) === record[field];
            candidate.checks[field] = ok;
            // Проверяем ВСЕ условия, а не до первого несовпадения: решето
            // показывает всю строку, и пустые клетки в ней читались бы как
            // «не проверяли». А в счёт отсева год идёт один раз, первому
            // отвергнувшему, — иначе итог не сойдётся с числом лет.
            if (!ok && candidate.fits) {
                candidate.fits = false;
                candidate.failedOn = field;
                killed[field] = (killed[field] ?? 0) + 1;
            }
        }
    }

    return {
        candidates,
        survivors: candidates.filter(c => c.fits),
        applied, killed, killedByDate,
        considered: candidates.length,
    };
};

export interface Fix {
    field: Field | "leto";
    label: string;
    stated: number | string | undefined;
    needed: number | string | null;
    /** Насколько велика поправка; null — величина не числовая, мерить нечем. */
    size: number | null;
    candidate: Candidate;
    /** Чем поправку пояснить: каким счётом названо лето, какие стили сошлись. */
    note?: string;
}

const correctionSize = (
    field: Field, stated: unknown, needed: unknown,
): number | null => {
    const length = CYCLES[field];
    if (!length || typeof stated !== "number" || typeof needed !== "number") return null;
    const gap = Math.abs(stated - needed) % length;
    return Math.min(gap, length - gap);
};

/**
 * Что мешало. Выбрасывает условия по одному и возвращает не факт оживления, а
 * ПОПРАВКУ: какое чтение потребовалось бы на месте выброшенного условия.
 * «Читать индикт не 6, а 7, и всё сходится на 1204» — довод, с которым можно
 * идти к рукописи; «без индикта что-то есть» — нет.
 *
 * Порядок — по величине правки, а не по вероятности: описка на единицу
 * правдоподобнее описки на четыре, но решает это палеография, а не наш ключ
 * сортировки.
 */
export const diagnose = (record: Record_, firstAd: number, lastAd: number): Fix[] => {
    const out: Fix[] = [];
    for (const field of FIELDS) {
        if (record[field] === undefined) continue;
        for (const candidate of solve(record, firstAd, lastAd, [field]).survivors) {
            const needed = actualValue(field, candidate);
            out.push({
                field, label: FIELD_LABELS[field], stated: record[field], needed,
                size: correctionSize(field, record[field], needed), candidate,
            });
        }
    }
    if (record.leto) {
        const { leto, style, ...rest } = record;
        for (const candidate of solve(rest, firstAd, lastAd).survivors) {
            out.push({
                field: "leto", label: "лето", stated: leto,
                // Лето без стиля не число: без оговорки, каким счётом оно
                // названо, поправка читалась бы как чужая описка.
                needed: ch.letoOf(candidate.span.first, "martovskiy"),
                size: null, candidate, note: "мартовским счётом",
            });
        }
    }

    // Одна и та же поправка приходит столько раз, сколько чтений лета она
    // спасает: у мартовского с сентябрьским день один и тот же, и печатать
    // его дважды значит выдать одно наблюдение за два.
    const merged = new Map<string, Fix>();
    for (const fix of out) {
        const key = `${fix.field}|${fix.needed}|${fix.candidate.jdn ?? fix.candidate.label}`;
        const seen = merged.get(key);
        if (!seen) {
            merged.set(key, fix);
            continue;
        }
        const styles = [...seen.candidate.styles, ...fix.candidate.styles]
            .map(s => ch.ERA_LABELS[s]);
        if (styles.length > 1) seen.note = `${styles.join(" и ")} сходятся одинаково`;
    }
    return [...merged.values()].sort((a, b) => (a.size ?? 99) - (b.size ?? 99));
};

export type VerdictKind = "none" | "one" | "same-day" | "many";

export interface Verdict {
    kind: VerdictKind;
    text: string;
}

/**
 * Каким из исходов кончился перебор. Отдельно выделено то, ради чего стоило
 * городить стили: чтений лета уцелело несколько, а ДЕНЬ у них один. Мартовский
 * стиль с сентябрьским расходятся только на сентябре–декабре, и запись,
 * попавшая в март–август, их не различает — но датируется при этом точно.
 * Сказать тут «ответ неоднозначен» значило бы отдать твёрдую дату за спор о
 * стиле, которого запись не решает и решать не обязана.
 */
export const verdict = (result: Result): Verdict => {
    const { survivors } = result;
    if (!survivors.length) {
        return { kind: "none", text: "ни одного года: запись противоречит сама себе" };
    }
    if (survivors.length === 1) {
        return { kind: "one", text: `один год: ${survivors[0].label}` };
    }
    // Разные чтения с одним днём остаются РАЗНЫМИ кандидатами, когда у них
    // разные лета круга: сентябрьское с ультрамартовским на октябрьском числе
    // дают один день, но разный индикт. Свести их нельзя — запись, назвавшая
    // индикт, их различит; а если не назвала, то день всё равно один, и это
    // ответ, а не неопределённость.
    const days = new Set(survivors.map(c => c.jdn));
    if (days.size === 1 && !days.has(null)) {
        const styles = survivors.flatMap(c => c.styles).map(s => ch.ERA_LABELS[s]).join(", ");
        return { kind: "same-day", text: `день один и тот же, счёт эры не различается: ${styles}` };
    }
    return { kind: "many", text: `${survivors.length} ответа: запись недоопределена` };
};
