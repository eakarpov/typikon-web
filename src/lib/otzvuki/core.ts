// Свод цитируемости: чем богослужение читает Писание.
//
// Слой цитат (@/lib/citations) отвечает про одну строку и про один стих: что в
// ней процитировано и где ещё это место звучит. Про Писание целиком не отвечал
// никто, а вопрос стоит того: из 36 961 стиха канона богослужение уверенно
// касается 7 536 — пятой части, — и обратная сторона этого числа интереснее
// прямой. Места, которых служба не поёт и не читает, не видны ничем, кроме
// этого индекса.
//
// ЧТЕНИЕ И ОТЗВУК — ДВА РАЗНЫХ ФАКТА, и это главное решение свода. Сличитель
// n-граммами нашёл 43 232 уверенные цитаты, но 17 100 из них (40 %) стоят на
// строках, которые Писанием и ЯВЛЯЮТСЯ: паремия, Апостол, Евангелие, прокимен.
// Паремия совпала сама с собой, и это не цитата, а тождество. Сложи мы их
// вместе — вышло бы «Бытие востребовано не меньше Псалтири», хотя Бытие
// читается (464 стиха) и почти не поётся (151), а у Псалтири наоборот:
// 1 025 поётся против 306 читаемых. Поэтому у стиха здесь два счёта, и
// «не звучит вовсе» значит: ни в одном, ни в другом.
//
// Чистые функции держим отдельно от выборок (store.ts) по той же причине, что
// в @/lib/accents: их зовёт и скрипт пересчёта, и страница, а тесту не нужна
// ни Монга, ни корпус.

/**
 * Роды строк, которые Писанием и являются: их совпадение — не цитата.
 *
 * `verse` в этом списке не по недосмотру: 65 таких строк корпуса — стихи
 * прокимна и аллилуиария, то есть псаломский стих, напечатанный собой
 * («Словеса́ Госпо́дня, словеса́ чи́ста» — Пс. 11:7). `psalter-reading` схема
 * допускает, но в сегодняшнем корпусе таких строк нет ни одной; оставлен,
 * чтобы кафизмы, когда их разберут, попали на нужную сторону сами.
 *
 * Величание осталось среди песнопений, хотя часть его строк начинается
 * «Псало́м избра́нный:» и дальше идёт сам псалом. Это 52 уверенные цитаты из
 * 43 232 — тысячная доля, — и ради неё делить род пополам не стоит; но знать
 * об этом, глядя на верхушку Псалтири, полезно.
 */
export const READING_UNITS = [
    "paremiya",
    "apostol",
    "evangelie",
    "prokimen",
    "verse",
    "psalter-reading",
] as const;

const READING_SET: ReadonlySet<string> = new Set(READING_UNITS);

/**
 * Напечатан ли этот род строки самим Писанием.
 *
 * Незнакомый род считаем песнопением, а не чтением: список чтений закрыт и
 * известен, а роды песнопений корпус добавляет по мере разбора книг, и новый
 * (скажем, «эксапостиларий») должен попасть в отзвуки сам, без правки здесь.
 */
export const isReading = (unit: string | null | undefined): boolean =>
    !!unit && READING_SET.has(unit);

/** Сколько песнопений и чтений приходится на один стих. */
export interface VerseCounts {
    /** Номер стиха в главе. */
    v: number;
    /** Процитирован в песнопении. */
    sung: number;
    /** Напечатан чтением. */
    read: number;
}

export interface ChapterMap {
    chapter: number;
    /** Только стихи, о которых есть что сказать: нулевых в базе не держим. */
    verses: VerseCounts[];
}

/**
 * Отрезок, который богослужение не трогает вовсе.
 *
 * Считается по всей книге подряд, а не внутри главы: молчание редко
 * укладывается в границы главы, и разрезанное по ним оно перестаёт читаться
 * как молчание. «Чис. 7:12 — 8:26» — это один отрезок, а не два.
 */
export interface SilentRun {
    fromChapter: number;
    fromVerse: number;
    toChapter: number;
    toVerse: number;
    verses: number;
}

export interface BookCitations {
    certain: number;
    candidate: number;
}

export interface BookStats {
    canonId: string;
    /** Место в каноническом порядке; у неканонических адресов его нет. */
    order: number | null;
    section: string | null;
    inCanon: boolean;
    citations: BookCitations;
    /** Песнопений и чтений, где книга хоть раз названа. */
    chants: number;
    verses: {
        sung: number;
        read: number;
        any: number;
    };
    /** Стихов в книге по справочной разбивке; null — книги в каноне нет. */
    referenceVerses: number | null;
    chapters: ChapterMap[];
    silent: SilentRun[];
    /**
     * Адреса, которых нет в справочной разбивке.
     *
     * Корпус ссылается на стих, которого елизаветинская разбивка в этой главе
     * не печатает: расхождение версификаций, а не ошибка счёта. Прятать его
     * нельзя — на нём молча ломается охват (стихов «затронуто» может стать
     * больше, чем их есть), — поэтому он выведен отдельным списком.
     */
    outsideReference: Array<{ chapter: number; verse: number }>;
}

export interface CitationSummary {
    citations: BookCitations;
    /** Строк корпуса, где нашлась хоть одна цитата. */
    chants: number;
    verses: {
        sung: number;
        read: number;
        any: number;
        /** Со всеми кандидатами — число, которым нельзя вести счёт. */
        withCandidates: number;
    };
    /** Стихов в каноне: знаменатель охвата. */
    canonVerses: number;
    booksInCanon: number;
    booksOutside: number;
    /** Стихов, которых справочная разбивка не знает: расхождение версификаций. */
    outsideReference: number;
    generatedAt: string;
    /**
     * Отпечаток корпуса: по нему видно, что свод описывает уже не тот файл.
     *
     * Не размер и не время правки файла, хотя это было первым решением:
     * выкладка возит корпус архивом, а `unzip` округляет время до двух секунд
     * и переставляет его по своему усмотрению. Три счётчика, наоборот, едут
     * ВНУТРИ файла и меняются с каждой пересборкой (`build_db.py` сносит базу
     * и строит заново, автоинкременты сдвигаются). Стоят они три мгновенных
     * `max()`, так что страница может спрашивать их на каждый заход.
     */
    stamp: CorpusStamp | null;
}

/** Три счётчика, которыми корпус отличается от прежней своей сборки. */
export interface CorpusStamp {
    items: number;
    groups: number;
    citations: number;
}

export interface TopVerse {
    canonRef: string;
    canonId: string;
    chapter: number;
    verse: number;
    count: number;
    /**
     * В скольких разных памятях это звучит.
     *
     * Второе число рядом с первым отвечает на возражение, которое верхушка
     * этого списка вызывает сама: «Дан. 3:57 — 1 349 раз» может значить и
     * «поётся всякой службе», и «напечатано подряд в одной книге». 386 памятей
     * рядом с 1 349 строками говорят, что первое.
     */
    memories: number;
    /** Строка корпуса, на которую можно сослаться как на образец. */
    sampleItemId: number | null;
}

export interface TopStats {
    sung: TopVerse[];
    read: TopVerse[];
}

/**
 * Охват книги в процентах с одним знаком после запятой.
 *
 * null, а не ноль, когда знаменателя нет: у девяти адресов вне канона
 * (Песни библейские, Даниил по LXX, Енох) справочной разбивки не существует,
 * и «0 %» соврало бы вместо того, чтобы промолчать.
 */
export const coveragePercent = (verses: number, reference: number | null): number | null => {
    if (!reference || reference <= 0) return null;
    return Math.round((verses / reference) * 1000) / 10;
};

/** Ступени густоты для карты: ноль, единица, немного, много. */
export const DENSITY_STEPS = [0, 1, 2, 5] as const;

/**
 * В какую ступень попадает число.
 *
 * Ступеней четыре, потому что глазу на карте в две тысячи клеток больше не
 * различить, а границы 1 / 2–4 / 5+ выбраны по данным: у половины затронутых
 * стихов ровно одно упоминание, и не отделив единицу, мы покрасили бы весь
 * псалтирный лист одинаково.
 */
export const densityStep = (count: number): number => {
    if (count <= 0) return 0;
    if (count === 1) return 1;
    if (count < 5) return 2;
    return 3;
};

/**
 * Молчащие отрезки книги — по справочной разбивке и карте затронутых стихов.
 *
 * Идём по книге подряд, стих за стихом: стих звучит, если у него есть хоть
 * одно упоминание любого рода. Отрезки короче `min` не показываем — пропуск
 * в один-два стиха посреди поемой главы говорит не о молчании, а о том, что
 * сличитель не дотянулся, и списком таких пропусков нельзя пользоваться.
 */
export const silentRuns = (
    chapters: ChapterMap[],
    chapterLengths: number[] | null,
    min = 10,
    limit = 12,
): SilentRun[] => {
    if (!chapterLengths || !chapterLengths.length) return [];

    const voiced = new Set<number>();
    for (const chapter of chapters) {
        for (const verse of chapter.verses) {
            if (verse.sung > 0 || verse.read > 0) voiced.add(chapter.chapter * 100000 + verse.v);
        }
    }

    const runs: SilentRun[] = [];
    let start: { chapter: number; verse: number } | null = null;
    let last: { chapter: number; verse: number } | null = null;

    const close = () => {
        if (!start || !last) return;
        const verses = countBetween(start, last, chapterLengths);
        if (verses >= min) {
            runs.push({
                fromChapter: start.chapter,
                fromVerse: start.verse,
                toChapter: last.chapter,
                toVerse: last.verse,
                verses,
            });
        }
        start = null;
        last = null;
    };

    for (let chapter = 1; chapter <= chapterLengths.length; chapter++) {
        const length = chapterLengths[chapter - 1] || 0;
        // Глава, которой в справочной разбивке нет вовсе (нулевая длина), —
        // не молчание, а отсутствие: разрываем отрезок на ней.
        if (!length) {
            close();
            continue;
        }
        for (let verse = 1; verse <= length; verse++) {
            if (voiced.has(chapter * 100000 + verse)) {
                close();
                continue;
            }
            if (!start) start = { chapter, verse };
            last = { chapter, verse };
        }
    }
    close();

    return runs.sort((a, b) => b.verses - a.verses).slice(0, limit);
};

/** Сколько стихов лежит между двумя адресами включительно. */
const countBetween = (
    from: { chapter: number; verse: number },
    to: { chapter: number; verse: number },
    lengths: number[],
): number => {
    if (from.chapter === to.chapter) return to.verse - from.verse + 1;
    let total = (lengths[from.chapter - 1] || 0) - from.verse + 1;
    for (let chapter = from.chapter + 1; chapter < to.chapter; chapter++) {
        total += lengths[chapter - 1] || 0;
    }
    return total + to.verse;
};
