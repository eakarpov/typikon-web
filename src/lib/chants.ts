import { rulesDb } from "@/lib/rulesDb";
import { normalizeQuery } from "@/lib/search";

// Поиск по певческим текстам книг — Октоиха, Миней, Триодей, Ирмология.
//
// Устроен иначе, чем поиск по библиотеке (@/lib/search), и намеренно.
// Там тексты лежат в Mongo, и снимать ударения приходится заранее, храня
// нормализованные копии полей: +13 МБ на коллекцию в 25 МБ. Здесь корпус
// лежит в SQLite, и снимает ударения сам токенизатор FTS5 — «unicode61
// remove_diacritics 2» делает это при разборе на слова, разом и в тексте, и
// в запросе. Копий держать не нужно, а snippet() отдаёт фрагмент из исходной
// строки, то есть с ударениями, как напечатано в книге.

/** Короче трёх букв искать нечего: выдача вырождается в весь корпус. */
export const MIN_QUERY_LENGTH = 3;

// Границы найденного внутри фрагмента. Управляющие символы, а не разметка:
// фрагмент уходит и в JSON, и в React, и разметка в нём была бы либо
// экранирована (и видна читателю как теги), либо вставлена как HTML — чего
// делать не станем. В корпусе этих символов нет и быть не может.
export const HIT_OPEN = "\u0002";
export const HIT_CLOSE = "\u0003";
const HIT_SPLIT = /[\u0002\u0003]/;

/**
 * Выражение FTS5 для строки, которую набрал человек.
 *
 * Оборачиваем во ФРАЗУ с префиксом: `"спаси ны"*` — именно эта
 * последовательность слов, у последнего можно недописать хвост. Так поиск
 * ведёт себя как подстрока, к которой все привыкли (сверено на корпусе:
 * «услыши» — 557 совпадений, «воззвах» — 80, ровно как при LIKE), а не как
 * «все эти слова где угодно» — у «спаси ны» это дало бы 309 вместо 213.
 *
 * Кавычки внутри удваиваем. Заодно это обезвреживает весь синтаксис FTS5:
 * внутри фразы звёздочки, скобки, двоеточия, NEAR/AND/OR перестают быть
 * операторами, и любая строка из поля ввода остаётся допустимым выражением,
 * а не ошибкой разбора.
 */
// «й» прячем от нормализации и возвращаем на место после неё.
//
// normalizeQuery() снимает ударения через NFD, а NFD разбирает и «й» — на «и»
// с кратким (U+0306), и краткое стирается вместе с ударениями: они в одном
// диапазоне. Поиску по библиотеке это не вредит, там нормализована и хранимая
// копия — обе стороны становятся «радуися» и сходятся. Здесь второй стороны
// нет: в индексе лежит сам текст книги, а токенизатор FTS5 «й» не разбирает
// (сверено на корпусе: «радуйся» — 3586 совпадений, «радуися» — ноль).
//
// Цена промаха — две трети корпуса: «й» стоит в 59 638 строках из 94 700, и
// «радуйся», «взбранной», «святый» не находили ничего вообще.
//
// «ё» защищать не нужно и не стоит: в корпусе оно всего в девяти строках, а
// нормализация приводит его к «е», как книги его и печатают.
const SHORT_I = /[йЙ]/g;
const SHORT_I_MASK = "\uE000";

/** Нормализация запроса для FTS5: ЦС-графику приводим, ударения оставляем
 *  токенизатору, «й» сохраняем. */
export const normalizeChantQuery = (query: string): string => {
    const masked = query.replace(SHORT_I, SHORT_I_MASK);
    return normalizeQuery(masked).split(SHORT_I_MASK).join("й");
};

export const matchExpression = (query: string): string =>
    `"${normalizeChantQuery(query).replace(/"/g, '""')}"*`;

export interface SnippetPart {
    text: string;
    hit: boolean;
}

/** Фрагмент, разложенный на куски: найденное отдельно от остального. */
export const splitSnippet = (snippet: string | null | undefined): SnippetPart[] => {
    if (!snippet) return [];
    return snippet
        .split(HIT_SPLIT)
        // Разделители чередуются, поэтому найденное — всегда нечётные куски.
        .map((text, i) => ({ text, hit: i % 2 === 1 }))
        .filter(part => part.text.length > 0);
};

export interface ChantFilters {
    /**
     * Откуда строка: 'book' | 'canon' | 'akathist'.
     *
     * Это не книга и не жанр, а ВЛАДЕЛЕЦ строки в корпусе — тот самый, что
     * задан в схеме: строка принадлежит ровно одному из трёх (group_id,
     * canon_id, akathist_id). Отсюда и три значения, и то, что они не
     * пересекаются: 35 626 строк на местах служб, 59 049 в канонах, 15 086 в
     * акафистах.
     *
     * Нужен фасет прежде всего из-за акафистов: их 15 тысяч строф, и по
     * частым словам («ра́дуйся», «Богоро́дице») они забивают книги. Разделять
     * их надо не по достоинству и не по книге, а именно по тому, чем строка
     * является в корпусе.
     */
    source?: string | null;
    book?: string | null;
    month?: number | null;
    day?: number | null;
    tone?: number | null;
    sign?: string | null;
    memoryId?: string | null;
    service?: string | null;
    unit?: string | null;
    /**
     * Язык ТЕКСТА, а не книги.
     *
     * Понадобился, когда корпус перестал быть славянским: сегодня в нём
     * 123 тысячи славянских строк, 53 тысячи румынских, 34 греческих и 24
     * английских. Отбором это не мешало — кириллический запрос румынских
     * строк не находит и так, — но обратное неверно: «Domnului» отдаёт две
     * тысячи румынских строк, и без отбора по языку сузить их нечем.
     */
    language?: string | null;
}

export interface ChantHit {
    id: number;
    snippet: SnippetPart[];
    unit: string;
    ode: number | null;
    marker: string | null;
    placement: string | null;
    memoryId: string | null;
    memory: string | null;
    book: string | null;
    month: number | null;
    day: number | null;
    service: string | null;
    position: string | null;
    tone: number | null;
    sign: string | null;
    // Откуда строка, когда она не из книги: у акафиста нет ни памяти, ни
    // места службы, и без этих трёх полей он выводился бы безымянным —
    // фрагмент есть, а чей он, не сказано.
    akathist: string | null;
    stanza: number | null;
    stanzaKind: string | null;
    /** Язык самой строки: корпус больше не одноязычен. */
    language: string;
    /** Издание, откуда строка, — у переводов их несколько на одно место. */
    sourceBook: string | null;
}

export interface Condition {
    sql: string;
    /** Условию не всегда нужно значение: отбор по владельцу строки — это
     *  проверка на NULL, плейсхолдера у неё нет. */
    value?: string | number;
}

// Владелец строки -> условие. Держим таблицей, а не склейкой на месте: имя
// приходит из адреса страницы, и подставлять оттуда что-либо в SQL нельзя.
const SOURCE_CONDITION: Record<string, string> = {
    book: "ci.group_id IS NOT NULL",
    canon: "ci.canon_id IS NOT NULL",
    akathist: "ci.akathist_id IS NOT NULL",
    prayer: "ci.prayer_id IS NOT NULL",
};

/**
 * Условия отбора. Все — через плейсхолдеры: в этом самом месте, но в поиске по
 * родословной, строка запроса однажды уже оказалась подставленной в SQL
 * напрямую (см. аудит в ROADMAP).
 */
export const conditionsFor = (filters: ChantFilters): Condition[] => {
    const out: Condition[] = [];
    const add = (sql: string, value: string | number | null | undefined) => {
        if (value !== null && value !== undefined && value !== "") out.push({ sql, value });
    };
    const source = filters.source && SOURCE_CONDITION[filters.source];
    if (source) out.push({ sql: source });
    add("m.book = ?", filters.book);
    add("m.month = ?", filters.month);
    add("m.day = ?", filters.day);
    add("m.memory_id = ?", filters.memoryId);
    add("COALESCE(g.tone, c.tone) = ?", filters.tone);
    add("COALESCE(g.service, c.service) = ?", filters.service);
    add("ci.content_unit = ?", filters.unit);
    add("s.default_sign = ?", filters.sign);
    add("ci.language = ?", filters.language);
    return out;
};

// Соединения нужны только под фильтры; без них отбор идёт по одному индексу.
// Знак живёт во вью (memory_signs разрешает его по трём источникам), поэтому
// подключается лишь тогда, когда по нему действительно фильтруют.
//
// memories соединяется ВНЕШНЕ, и это не мелочь. Строка корпуса принадлежит
// одному из трёх владельцев — группе службы, канону или акафисту, — и памяти
// нет только у третьего: акафист не день книги, у него нет ни числа
// месяцеслова, ни отступа от Пасхи, ни гласа. Пока соединение было внутренним,
// оно отсекало акафист от ЛЮБОГО фильтра, включая те, что памяти не касаются
// вовсе: «показать все икосы» — это ci.content_unit, но отбор всё равно шёл
// через memories и терял 25 строф молча.
//
// Фильтры по самой памяти (книга, месяц, число, знак) акафист по-прежнему не
// выбирают — и правильно: у него этих признаков нет, а NULL под равенство не
// подходит. Разница в том, что теперь это следствие условия, а не соединения.
const joinsFor = (needsSign: boolean) => `
    JOIN content_items ci ON ci.item_id = f.rowid
    LEFT JOIN groups g ON g.group_id = ci.group_id
    LEFT JOIN canons c ON c.canon_id = ci.canon_id
    LEFT JOIN memories m ON m.memory_id = COALESCE(g.memory_id, c.memory_id)
    ${needsSign ? "LEFT JOIN memory_signs s ON s.memory_id = m.memory_id" : ""}`;

export interface ChantSearchResult {
    items: ChantHit[];
    total: number;
}

/**
 * Ранжируем и отрезаем страницу ПЕРЕД тем, как соединять таблицы для показа.
 *
 * Порядок здесь решает всё: если оставить `ORDER BY bm25(...)` снаружи
 * соединений, SQLite соберёт все совпадения со всеми их памятями, позициями и
 * знаками и только потом отсортирует, — на «богородице» это 4924 строки и
 * полсекунды. С уже отрезанной страницей соединять приходится двадцать строк,
 * и тот же запрос укладывается в 11 мс.
 */
export const searchChants = (
    query: string,
    filters: ChantFilters = {},
    limit = 20,
    offset = 0,
): ChantSearchResult | null => {
    const db = rulesDb();
    if (!db) return null;

    const conditions = conditionsFor(filters);
    const needsSign = conditions.some(c => c.sql.startsWith("s."));
    const where = conditions.map(c => c.sql).join(" AND ");
    // Значения — только у условий с плейсхолдером, и порядок при этом
    // сохраняется: отбор по владельцу вставляется в SQL как есть.
    const values = conditions.flatMap(c => (c.value === undefined ? [] : [c.value]));
    const match = matchExpression(query);

    const from = `FROM content_items_fts f ${conditions.length ? joinsFor(needsSign) : ""}
        WHERE f.content_items_fts MATCH ? ${where ? `AND ${where}` : ""}`;

    const total = db.prepare(`SELECT count(*) AS n ${from}`).get(match, ...values) as { n: number };

    const rows = db.prepare(`
        WITH hits AS (
            SELECT f.rowid AS item_id,
                   bm25(f.content_items_fts) AS rank,
                   snippet(f.content_items_fts, 0, char(2), char(3), '…', 14) AS snippet
            ${from}
            ORDER BY rank
            LIMIT ? OFFSET ?
        )
        SELECT h.item_id, h.snippet,
               ci.content_unit, ci.ode, ci.marker, ci.placement,
               m.memory_id, m.label AS memory_label, m.book, m.month, m.day,
               COALESCE(g.service, c.service) AS service,
               COALESCE(g.tone, c.tone) AS tone,
               p.label AS position_label,
               s.default_sign AS sign,
               a.title AS akathist_title, ci.stanza, ci.stanza_kind,
               ci.language, g.source_book
        FROM hits h
        JOIN content_items ci ON ci.item_id = h.item_id
        LEFT JOIN groups g ON g.group_id = ci.group_id
        LEFT JOIN canons c ON c.canon_id = ci.canon_id
        LEFT JOIN akathists a ON a.akathist_id = ci.akathist_id
        LEFT JOIN memories m ON m.memory_id = COALESCE(g.memory_id, c.memory_id)
        LEFT JOIN positions p ON p.position_id = COALESCE(g.position_id, c.position_id)
        LEFT JOIN memory_signs s ON s.memory_id = m.memory_id
        ORDER BY h.rank
    `).all(match, ...values, limit, offset) as any[];

    return {
        total: total?.n ?? 0,
        items: rows.map(r => ({
            id: r.item_id,
            snippet: splitSnippet(r.snippet),
            unit: r.content_unit,
            ode: r.ode ?? null,
            marker: r.marker ?? null,
            placement: r.placement ?? null,
            memoryId: r.memory_id ?? null,
            memory: r.memory_label ?? null,
            book: r.book ?? null,
            month: r.month ?? null,
            day: r.day ?? null,
            service: r.service ?? null,
            position: r.position_label ?? null,
            tone: r.tone ?? null,
            sign: r.sign ?? null,
            akathist: r.akathist_title ?? null,
            stanza: r.stanza ?? null,
            stanzaKind: r.stanza_kind ?? null,
            language: r.language ?? "cu_gr",
            sourceBook: r.source_book ?? null,
        })),
    };
};

export interface ChantFacets {
    sources: string[];
    books: string[];
    months: number[];
    tones: number[];
    signs: string[];
    services: string[];
    units: string[];
    languages: { code: string; count: number }[];
}

/**
 * Чем можно сузить поиск. Берём из самого корпуса, а не списком в коде: книги
 * вводятся помесячно, роды песнопений прибавляются по мере разбора, и
 * захардкоженный перечень разошёлся бы с содержимым молча.
 */
export const chantFacets = (): ChantFacets | null => {
    const db = rulesDb();
    if (!db) return null;

    const column = <T>(sql: string): T[] =>
        (db.prepare(sql).all() as any[]).map(r => Object.values(r)[0]).filter(v => v !== null) as T[];

    return {
        // Какие владельцы в корпусе вообще есть: акафистов может не быть
        // вовсе, и предлагать по ним отбор было бы обманом.
        sources: ["book", "canon", "akathist", "prayer"].filter((s, i) =>
            (db.prepare(
                `SELECT count(*) AS n FROM content_items WHERE ${
                    ["group_id", "canon_id", "akathist_id", "prayer_id"][i]} IS NOT NULL LIMIT 1`,
            ).get() as { n: number }).n > 0),
        books: column<string>("SELECT DISTINCT book FROM memories ORDER BY book"),
        months: column<number>("SELECT DISTINCT month FROM memories WHERE month IS NOT NULL ORDER BY month"),
        tones: column<number>("SELECT DISTINCT tone FROM memories WHERE tone IS NOT NULL ORDER BY tone"),
        signs: column<string>("SELECT DISTINCT default_sign FROM memory_signs WHERE default_sign IS NOT NULL ORDER BY default_sign"),
        services: column<string>("SELECT DISTINCT service FROM groups WHERE service IS NOT NULL ORDER BY service"),
        units: column<string>("SELECT DISTINCT content_unit FROM content_items ORDER BY content_unit"),
        // Языки берём с числом строк и по убыванию: корпус на них разложен
        // очень неровно, и порядок по алфавиту поставил бы арабский с его
        // тремя сотнями строк впереди славянского со ста двадцатью тысячами.
        languages: (db.prepare(
            `SELECT language, count(*) AS n FROM content_items
              WHERE text IS NOT NULL GROUP BY language ORDER BY n DESC`,
        ).all() as any[]).map(r => ({ code: r.language as string, count: r.n as number })),
    };
};

export interface ChantDetail {
    id: number;
    text: string;
    /** Текста своего нет — он взят по ссылке (Ирмологий или соседний канон). */
    borrowed: boolean;
    language: string;
    unit: string;
    marker: string | null;
    markerAlt: string | null;
    placement: string | null;
    repeat: number;
    ode: number | null;
    stanza: number | null;
    stanzaKind: string | null;
    /** Глас — первый из трёх признаков, какими выбирается напев. */
    tone: number | null;
    /** Подобен, как его напечатала книга: с ударениями и заглавной буквы. */
    podoben: string | null;
    service: string | null;
    position: string | null;
    groupLabel: string | null;
    memoryId: string | null;
    memory: string | null;
    book: string | null;
    month: number | null;
    day: number | null;
    paschaOffset: number | null;
    weekday: string | null;
    memoryTone: number | null;
    sign: string | null;
    akathist: string | null;
    canonId: string | null;
}

/**
 * Одно песнопение целиком.
 *
 * Ссылки разрешаем здесь же, как это делают сборка устава и страница канона:
 * книги печатают ирмос зачином, а полный текст лежит в Ирмологии. Напев без
 * текста не разложить — раскладывать было бы нечего.
 */
export const getChant = (id: number): ChantDetail | null => {
    const db = rulesDb();
    if (!db) return null;

    const row = db.prepare(`
        SELECT ci.item_id, ci.content_unit, ci.ode, ci.marker, ci.marker_alt,
               ci.placement, ci.repeat_count, ci.stanza, ci.stanza_kind,
               ci.language, ci.text, ci.canon_id, ci.ref_id,
               f.text AS from_dictionary, o.text AS from_item,
               g.podoben, g.group_label,
               COALESCE(g.tone, c.tone) AS tone,
               COALESCE(g.service, c.service) AS service,
               p.label AS position_label,
               m.memory_id, m.label AS memory, m.book, m.month, m.day,
               m.pascha_offset, m.weekday, m.tone AS memory_tone,
               a.title AS akathist_title,
               s.default_sign AS sign
        FROM content_items ci
        LEFT JOIN groups g ON g.group_id = ci.group_id
        LEFT JOIN canons c ON c.canon_id = ci.canon_id
        LEFT JOIN akathists a ON a.akathist_id = ci.akathist_id
        LEFT JOIN fixed_texts f ON f.text_id = ci.ref_text_id
        LEFT JOIN content_items o ON o.item_id = ci.ref_item_id
        LEFT JOIN memories m ON m.memory_id = COALESCE(g.memory_id, c.memory_id)
        LEFT JOIN positions p ON p.position_id = COALESCE(g.position_id, c.position_id)
        LEFT JOIN memory_signs s ON s.memory_id = m.memory_id
        WHERE ci.item_id = ?`).get(id) as any;
    if (!row) return null;

    const resolved = row.from_dictionary ?? row.from_item ?? null;

    return {
        id: row.item_id,
        text: row.text ?? resolved ?? "",
        borrowed: row.text === null && resolved !== null,
        language: row.language ?? "cu_gr",
        unit: row.content_unit,
        marker: row.marker ?? null,
        markerAlt: row.marker_alt ?? null,
        placement: row.placement ?? null,
        repeat: row.repeat_count ?? 1,
        ode: row.ode ?? null,
        stanza: row.stanza ?? null,
        stanzaKind: row.stanza_kind ?? null,
        tone: row.tone ?? null,
        podoben: row.podoben ?? null,
        service: row.service ?? null,
        position: row.position_label ?? null,
        groupLabel: row.group_label ?? null,
        memoryId: row.memory_id ?? null,
        memory: row.memory ?? null,
        book: row.book ?? null,
        month: row.month ?? null,
        day: row.day ?? null,
        paschaOffset: row.pascha_offset ?? null,
        weekday: row.weekday ?? null,
        memoryTone: row.memory_tone ?? null,
        sign: row.sign ?? null,
        akathist: row.akathist_title ?? null,
        canonId: row.canon_id ?? null,
    };
};
