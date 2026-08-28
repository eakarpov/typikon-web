import { rulesDb } from "@/lib/rulesDb";
import { normalizeQuery } from "@/lib/search";

// Указатель канонов корпуса typikon-rules и сборка канона по песням.
//
// Это не поиск по песнопениям (@/lib/chants), и устроено иначе. Там единица
// выдачи — одна строка книги, найденная по слову внутри неё; здесь единица —
// ЦЕЛЫЙ КАНОН, и ищут его не по тексту, а по тому, кому он: «Николаю
// Чудотворцу», «Иоанна Дамаскина». Поэтому и запрос идёт не по FTS, а по
// метке памяти и имени творца.
//
// ПОЧЕМУ ОТБОР ПО ИМЕНИ ИДЁТ В JS, А НЕ В SQL. Метки памятей набраны с
// ударениями («Васи́лия Вели́каго»), и LIKE по ним не работает: «Василия» не
// совпадёт ни с чем. Снять ударения средствами SQLite нечем — FTS5 умеет это
// только внутри своего индекса, а индекса по memories нет и заводить его ради
// 1519 строк не стоит. Канонов всего 1646, весь список весит около двухсот
// килобайт и собирается за 20 мс, поэтому забираем его целиком и отбираем
// уже здесь, нормализуя обе стороны одинаково.
//
// Тем же normalizeQuery, которым НЕЛЬЗЯ было пользоваться в @/lib/chants, —
// и разница ровно в симметрии. Там нормализовалась только одна сторона
// (запрос), а вторая лежала в индексе как есть, и «й» после NFD превращалось
// в «и», ломая треть корпуса. Здесь через ту же нормализацию проходят и
// запрос, и метка, так что «Радуйся» и «Ра́дуйся» сходятся в «радуися» оба.

export interface CanonFilters {
    q?: string | null;
    book?: string | null;
    tone?: number | null;
    service?: string | null;
    role?: string | null;
}

export interface CanonRow {
    id: string;
    /** Кому канон: метка памяти, под которой он напечатан. */
    memory: string;
    memoryId: string;
    book: string;
    month: number | null;
    day: number | null;
    paschaOffset: number | null;
    weekday: string | null;
    /** Глас памяти (у Октоиха) — не то же, что глас самого канона. */
    memoryTone: number | null;
    tone: number | null;
    creator: string | null;
    acrostic: string | null;
    service: string;
    role: string | null;
    odes: number;
    items: number;
}

export interface CanonSearchResult {
    items: CanonRow[];
    total: number;
}

const LIST_SQL = `
    SELECT c.canon_id, m.label AS memory, m.memory_id, m.book, m.month, m.day,
           m.pascha_offset, m.weekday, m.tone AS memory_tone,
           c.tone, c.creator, c.acrostic, c.service, c.role,
           count(DISTINCT ci.ode) AS odes, count(ci.item_id) AS items
    FROM canons c
    JOIN memories m ON m.memory_id = c.memory_id
    LEFT JOIN content_items ci ON ci.canon_id = c.canon_id
    GROUP BY c.canon_id
    ORDER BY m.book, m.month, m.day, m.pascha_offset, m.tone, c.rowid`;

const rowOf = (r: any): CanonRow => ({
    id: r.canon_id,
    memory: r.memory ?? "",
    memoryId: r.memory_id,
    book: r.book,
    month: r.month ?? null,
    day: r.day ?? null,
    paschaOffset: r.pascha_offset ?? null,
    weekday: r.weekday ?? null,
    memoryTone: r.memory_tone ?? null,
    tone: r.tone ?? null,
    creator: r.creator ?? null,
    acrostic: r.acrostic ?? null,
    service: r.service,
    role: r.role ?? null,
    odes: r.odes ?? 0,
    items: r.items ?? 0,
});

/** По чему ищем имя: кому канон, чьё творение, какое краегранесие. */
const haystack = (row: CanonRow) =>
    normalizeQuery([row.memory, row.creator, row.acrostic].filter(Boolean).join(" "));

export const listCanons = (
    filters: CanonFilters = {},
    limit = 25,
    offset = 0,
): CanonSearchResult | null => {
    const db = rulesDb();
    if (!db) return null;

    let rows = (db.prepare(LIST_SQL).all() as any[]).map(rowOf);

    if (filters.book) rows = rows.filter(r => r.book === filters.book);
    if (filters.tone) rows = rows.filter(r => r.tone === filters.tone);
    if (filters.service) rows = rows.filter(r => r.service === filters.service);
    if (filters.role) rows = rows.filter(r => r.role === filters.role);

    const q = normalizeQuery(filters.q || "");
    if (q) {
        // Все слова запроса, а не фраза: «дамаскина николаю» должно находить
        // канон Николаю творения Дамаскина, хотя рядом эти слова нигде не стоят.
        const words = q.split(" ").filter(Boolean);
        rows = rows.filter(r => {
            const hay = haystack(r);
            return words.every(w => hay.includes(w));
        });
    }

    return { total: rows.length, items: rows.slice(offset, offset + limit) };
};

export interface CanonFacets {
    books: string[];
    tones: number[];
    services: string[];
    roles: string[];
}

/** Чем можно сузить. Как и у песнопений — из самого корпуса, не списком в коде. */
export const canonFacets = (): CanonFacets | null => {
    const db = rulesDb();
    if (!db) return null;
    const column = <T>(sql: string): T[] =>
        (db.prepare(sql).all() as any[]).map(r => Object.values(r)[0]).filter(v => v !== null) as T[];
    return {
        books: column<string>("SELECT DISTINCT book FROM memories ORDER BY book"),
        tones: column<number>("SELECT DISTINCT tone FROM canons WHERE tone IS NOT NULL ORDER BY tone"),
        services: column<string>("SELECT DISTINCT service FROM canons ORDER BY service"),
        roles: column<string>("SELECT DISTINCT role FROM canons WHERE role IS NOT NULL ORDER BY role"),
    };
};

export interface CanonLine {
    unit: string;
    text: string;
    /** Текста своего нет — он взят по ссылке (Ирмологий или соседний канон). */
    borrowed: boolean;
    marker: string | null;
    repeat: number;
}

export interface CanonOde {
    ode: number;
    irmos: CanonLine[];
    troparia: CanonLine[];
}

export interface CanonDetail extends CanonRow {
    odesList: CanonOde[];
}

export const getCanon = (id: string): CanonDetail | null => {
    const db = rulesDb();
    if (!db) return null;

    const head = db.prepare(`
        SELECT c.canon_id, m.label AS memory, m.memory_id, m.book, m.month, m.day,
               m.pascha_offset, m.weekday, m.tone AS memory_tone,
               c.tone, c.creator, c.acrostic, c.service, c.role,
               (SELECT count(DISTINCT ode) FROM content_items WHERE canon_id = c.canon_id) AS odes,
               (SELECT count(*) FROM content_items WHERE canon_id = c.canon_id) AS items
        FROM canons c JOIN memories m ON m.memory_id = c.memory_id
        WHERE c.canon_id = ?`).get(id) as any;
    if (!head) return null;

    // Ссылки разрешаем здесь же, как это делает сборка устава
    // (typikon-rules/src/assemble.py): книги печатают ирмос зачином
    // («Ирмо́с: Христо́с ражда́ется:»), а полный текст лежит в Ирмологии или в
    // соседнем каноне. Показать зачин вместо ирмоса значило бы показать
    // отсылку вместо песнопения.
    const lines = db.prepare(`
        SELECT ci.ode, ci.content_unit, ci.marker, ci.repeat_count,
               ci.text, f.text AS from_dictionary, o.text AS from_item, ci.ref_id
        FROM content_items ci
        LEFT JOIN fixed_texts f ON f.text_id = ci.ref_text_id
        LEFT JOIN content_items o ON o.item_id = ci.ref_item_id
        WHERE ci.canon_id = ? ORDER BY ci.ode, ci.item_index`).all(id) as any[];

    const odes = new Map<number, CanonOde>();
    for (const l of lines) {
        const ode = odes.get(l.ode) ?? { ode: l.ode, irmos: [], troparia: [] };
        odes.set(l.ode, ode);
        const resolved = l.from_dictionary ?? l.from_item ?? null;
        const line: CanonLine = {
            unit: l.content_unit,
            // Ничего не нашлось ни своим текстом, ни по ссылке — показываем
            // саму ссылку. Пустая строка читалась бы как «песнопения нет»,
            // тогда как оно есть, просто мы его пока не разрешили.
            text: l.text ?? resolved ?? (l.ref_id ? `→ ${l.ref_id}` : ""),
            borrowed: l.text === null && resolved !== null,
            marker: l.marker ?? null,
            repeat: l.repeat_count ?? 1,
        };
        (l.content_unit === "irmos" ? ode.irmos : ode.troparia).push(line);
    }

    return {
        ...rowOf(head),
        odesList: [...odes.values()].sort((a, b) => a.ode - b.ode),
    };
};
