import { rulesDb } from "@/lib/rulesDb";
import { normalizeQuery } from "@/lib/search";

// Указатель молитв корпуса.
//
// Устроен как указатели канонов и акафистов (@/lib/canons, @/lib/akathists), и
// по той же причине: ищут молитву не по слову внутри, а по тому, при ком она
// стоит. Отбор по имени идёт в JS — метки с ударениями под LIKE не подходят;
// подробный разбор почему — в комментарии к canons.ts.
//
// ПОДПИСЬ МОЛИТВЫ НЕ НАЗЫВАЕТ. Двести тридцать пять книжных молитв из трёхсот
// подписаны просто «Моли́тва», и ещё столько же при акафистах — так же. Имя ей
// даёт владелец: «Моли́тва — свт. Василию Великому», «Моли́тва — Акафист
// святителю Николаю». Поэтому в выдаче стоит и то, и другое, а искать можно по
// обоим.

export interface PrayerFilters {
    q?: string | null;
    /** 'memory' | 'akathist' | 'canon' — при ком молитва напечатана. */
    kind?: string | null;
}

export interface PrayerRow {
    id: string;
    title: string | null;
    kind: string;
    /** Кому/чему: память книги, акафист или канон — смотря чья молитва. */
    owner: string;
    ownerId: string | null;
    seq: number;
    /** Начало текста: подпись у молитв неразличима, а зачин различает. */
    incipit: string;
}

export interface PrayerSearchResult {
    items: PrayerRow[];
    total: number;
}

const LIST_SQL = `
    SELECT p.prayer_id, p.title, p.kind, p.seq,
           COALESCE(m.label, a.title, cm.label) AS owner,
           COALESCE(p.memory_id, p.akathist_id, p.canon_id) AS owner_id,
           ci.text
    FROM prayers p
    LEFT JOIN memories m ON m.memory_id = p.memory_id
    LEFT JOIN akathists a ON a.akathist_id = p.akathist_id
    LEFT JOIN canons c ON c.canon_id = p.canon_id
    LEFT JOIN memories cm ON cm.memory_id = c.memory_id
    LEFT JOIN content_items ci ON ci.prayer_id = p.prayer_id
    ORDER BY p.kind, owner, p.seq`;

const INCIPIT_LENGTH = 120;

const rowOf = (r: any): PrayerRow => ({
    id: r.prayer_id,
    title: r.title ?? null,
    kind: r.kind,
    owner: r.owner ?? "",
    ownerId: r.owner_id ?? null,
    seq: r.seq ?? 1,
    incipit: (r.text ?? "").slice(0, INCIPIT_LENGTH),
});

export const listPrayers = (
    filters: PrayerFilters = {},
    limit = 25,
    offset = 0,
): PrayerSearchResult | null => {
    const db = rulesDb();
    if (!db) return null;

    let rows = (db.prepare(LIST_SQL).all() as any[]).map(rowOf);
    if (filters.kind) rows = rows.filter(r => r.kind === filters.kind);

    const q = normalizeQuery(filters.q || "");
    if (q) {
        const words = q.split(" ").filter(Boolean);
        rows = rows.filter(r => {
            // По владельцу, подписи И зачину: подпись почти всегда «Молитва»,
            // владелец даёт имя, а зачин — то единственное, чем две молитвы
            // одному святому отличаются друг от друга.
            const hay = normalizeQuery([r.owner, r.title, r.incipit].filter(Boolean).join(" "));
            return words.every(w => hay.includes(w));
        });
    }

    return { total: rows.length, items: rows.slice(offset, offset + limit) };
};

export interface PrayerFacets {
    kinds: string[];
}

export const prayerFacets = (): PrayerFacets | null => {
    const db = rulesDb();
    if (!db) return null;
    return {
        kinds: (db.prepare("SELECT DISTINCT kind FROM prayers ORDER BY kind").all() as any[])
            .map(r => r.kind),
    };
};

export interface PrayerDetail extends PrayerRow {
    text: string;
    language: string;
    sourceBook: string | null;
    sourceUrl: string | null;
    /** Соседние молитвы того же владельца: книга печатает их вереницей. */
    siblings: { id: string; title: string | null; seq: number }[];
}

export const getPrayer = (id: string): PrayerDetail | null => {
    const db = rulesDb();
    if (!db) return null;

    const head = db.prepare(`
        SELECT p.prayer_id, p.title, p.kind, p.seq, p.language,
               p.source_book, p.source_url,
               p.memory_id, p.akathist_id, p.canon_id,
               COALESCE(m.label, a.title, cm.label) AS owner,
               COALESCE(p.memory_id, p.akathist_id, p.canon_id) AS owner_id,
               ci.text
        FROM prayers p
        LEFT JOIN memories m ON m.memory_id = p.memory_id
        LEFT JOIN akathists a ON a.akathist_id = p.akathist_id
        LEFT JOIN canons c ON c.canon_id = p.canon_id
        LEFT JOIN memories cm ON cm.memory_id = c.memory_id
        LEFT JOIN content_items ci ON ci.prayer_id = p.prayer_id
        WHERE p.prayer_id = ?`).get(id) as any;
    if (!head) return null;

    const siblings = db.prepare(`
        SELECT prayer_id, title, seq FROM prayers
        WHERE prayer_id <> ?
          AND ((memory_id IS NOT NULL AND memory_id = ?)
            OR (akathist_id IS NOT NULL AND akathist_id = ?)
            OR (canon_id IS NOT NULL AND canon_id = ?))
        ORDER BY seq`).all(id, head.memory_id ?? null, head.akathist_id ?? null,
                           head.canon_id ?? null) as any[];

    return {
        ...rowOf(head),
        text: head.text ?? "",
        language: head.language ?? "cu_gr",
        sourceBook: head.source_book ?? null,
        sourceUrl: head.source_url ?? null,
        siblings: siblings.map(s => ({ id: s.prayer_id, title: s.title ?? null, seq: s.seq })),
    };
};

/** Молитвы при акафисте — для его страницы. */
export const prayersOfAkathist = (akathistId: string): PrayerRow[] => {
    const db = rulesDb();
    if (!db) return [];
    return (db.prepare(`
        SELECT p.prayer_id, p.title, p.kind, p.seq, a.title AS owner,
               p.akathist_id AS owner_id, ci.text
        FROM prayers p
        JOIN akathists a ON a.akathist_id = p.akathist_id
        LEFT JOIN content_items ci ON ci.prayer_id = p.prayer_id
        WHERE p.akathist_id = ? ORDER BY p.seq`).all(akathistId) as any[]).map(rowOf);
};
