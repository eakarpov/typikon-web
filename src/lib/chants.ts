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
export const matchExpression = (query: string): string =>
    `"${normalizeQuery(query).replace(/"/g, '""')}"*`;

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
    book?: string | null;
    month?: number | null;
    day?: number | null;
    tone?: number | null;
    sign?: string | null;
    memoryId?: string | null;
    service?: string | null;
    unit?: string | null;
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
}

export interface Condition {
    sql: string;
    value: string | number;
}

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
    add("m.book = ?", filters.book);
    add("m.month = ?", filters.month);
    add("m.day = ?", filters.day);
    add("m.memory_id = ?", filters.memoryId);
    add("COALESCE(g.tone, c.tone) = ?", filters.tone);
    add("COALESCE(g.service, c.service) = ?", filters.service);
    add("ci.content_unit = ?", filters.unit);
    add("s.default_sign = ?", filters.sign);
    return out;
};

// Соединения нужны только под фильтры; без них отбор идёт по одному индексу.
// Знак живёт во вью (memory_signs разрешает его по трём источникам), поэтому
// подключается лишь тогда, когда по нему действительно фильтруют.
const joinsFor = (needsSign: boolean) => `
    JOIN content_items ci ON ci.item_id = f.rowid
    LEFT JOIN groups g ON g.group_id = ci.group_id
    LEFT JOIN canons c ON c.canon_id = ci.canon_id
    JOIN memories m ON m.memory_id = COALESCE(g.memory_id, c.memory_id)
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
    const values = conditions.map(c => c.value);
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
               s.default_sign AS sign
        FROM hits h
        JOIN content_items ci ON ci.item_id = h.item_id
        LEFT JOIN groups g ON g.group_id = ci.group_id
        LEFT JOIN canons c ON c.canon_id = ci.canon_id
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
        })),
    };
};

export interface ChantFacets {
    books: string[];
    months: number[];
    tones: number[];
    signs: string[];
    services: string[];
    units: string[];
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
        books: column<string>("SELECT DISTINCT book FROM memories ORDER BY book"),
        months: column<number>("SELECT DISTINCT month FROM memories WHERE month IS NOT NULL ORDER BY month"),
        tones: column<number>("SELECT DISTINCT tone FROM memories WHERE tone IS NOT NULL ORDER BY tone"),
        signs: column<string>("SELECT DISTINCT default_sign FROM memory_signs WHERE default_sign IS NOT NULL ORDER BY default_sign"),
        services: column<string>("SELECT DISTINCT service FROM groups WHERE service IS NOT NULL ORDER BY service"),
        units: column<string>("SELECT DISTINCT content_unit FROM content_items ORDER BY content_unit"),
    };
};
