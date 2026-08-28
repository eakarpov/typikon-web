import { rulesDb } from "@/lib/rulesDb";
import { normalizeQuery } from "@/lib/search";

// Указатель акафистов корпуса typikon-rules и сборка акафиста по строфам.
//
// Устроен так же, как указатель канонов (@/lib/canons), и по той же причине:
// единица выдачи — целое произведение, а ищут его по тому, кому оно, а не по
// слову внутри. Отбор по имени идёт в JS — метки с ударениями под LIKE не
// подходят; подробный разбор почему — в комментарии к canons.ts.
//
// В СЛУЖБЫ АКАФИСТЫ НЕ ИДУТ, и раздел этого не обещает. Уставом положен один —
// Великий, в субботу Акафиста; остальные заводятся ради корпуса и поиска.
// Структурно это уже закрыто в самом корпусе: строка content_items
// принадлежит ровно одному владельцу (group_id | canon_id | akathist_id), а
// сборка устава ходит только по первым двум.

export interface AkathistFilters {
    q?: string | null;
    subjectKind?: string | null;
    status?: string | null;
}

export interface AkathistRow {
    id: string;
    title: string;
    /** Кому: Господу, Богородице, иконе, празднику, святому. */
    subjectKind: string;
    dneslovId: string | null;
    /** Чем акафист является уставу: ustavny | odobrenny | chastny. */
    status: string;
    /** Память книги, в службе которой напечатан. Есть только у Великого. */
    memoryId: string | null;
    memory: string | null;
    stanzas: number;
    prooimia: number;
}

export interface AkathistSearchResult {
    items: AkathistRow[];
    total: number;
}

const LIST_SQL = `
    SELECT a.akathist_id, a.title, a.subject_kind, a.dneslov_id, a.status,
           a.memory_id, m.label AS memory,
           count(ci.item_id) AS stanzas,
           sum(CASE WHEN ci.stanza_kind = 'prooimion' THEN 1 ELSE 0 END) AS prooimia
    FROM akathists a
    LEFT JOIN memories m ON m.memory_id = a.memory_id
    LEFT JOIN content_items ci ON ci.akathist_id = a.akathist_id
    GROUP BY a.akathist_id
    ORDER BY a.title`;

const rowOf = (r: any): AkathistRow => ({
    id: r.akathist_id,
    title: r.title ?? "",
    subjectKind: r.subject_kind,
    dneslovId: r.dneslov_id ?? null,
    status: r.status,
    memoryId: r.memory_id ?? null,
    memory: r.memory ?? null,
    stanzas: r.stanzas ?? 0,
    prooimia: r.prooimia ?? 0,
});

export const listAkathists = (
    filters: AkathistFilters = {},
    limit = 25,
    offset = 0,
): AkathistSearchResult | null => {
    const db = rulesDb();
    if (!db) return null;

    let rows = (db.prepare(LIST_SQL).all() as any[]).map(rowOf);

    if (filters.subjectKind) rows = rows.filter(r => r.subjectKind === filters.subjectKind);
    if (filters.status) rows = rows.filter(r => r.status === filters.status);

    const q = normalizeQuery(filters.q || "");
    if (q) {
        const words = q.split(" ").filter(Boolean);
        rows = rows.filter(r => {
            const hay = normalizeQuery([r.title, r.memory].filter(Boolean).join(" "));
            return words.every(w => hay.includes(w));
        });
    }

    return { total: rows.length, items: rows.slice(offset, offset + limit) };
};

export interface AkathistFacets {
    subjectKinds: string[];
    statuses: string[];
}

export const akathistFacets = (): AkathistFacets | null => {
    const db = rulesDb();
    if (!db) return null;
    const column = (sql: string): string[] =>
        (db.prepare(sql).all() as any[]).map(r => Object.values(r)[0]).filter(Boolean) as string[];
    return {
        subjectKinds: column("SELECT DISTINCT subject_kind FROM akathists ORDER BY subject_kind"),
        statuses: column("SELECT DISTINCT status FROM akathists ORDER BY status"),
    };
};

export interface AkathistStanza {
    index: number;
    /** 'prooimion' | 'stanza' — проимий в акростих не входит и нумеруется своим счётом. */
    kind: string;
    unit: string;
    stanza: number;
    letter: string | null;
    text: string;
}

export interface AkathistDetail extends AkathistRow {
    refrainIkos: string | null;
    refrainKontakion: string | null;
    sourceBook: string | null;
    sourceUrl: string | null;
    lines: AkathistStanza[];
}

export const getAkathist = (id: string): AkathistDetail | null => {
    const db = rulesDb();
    if (!db) return null;

    const head = db.prepare(`
        SELECT a.akathist_id, a.title, a.subject_kind, a.dneslov_id, a.status,
               a.memory_id, m.label AS memory, a.refrain_ikos, a.refrain_kontakion,
               a.source_book, a.source_url,
               (SELECT count(*) FROM content_items WHERE akathist_id = a.akathist_id) AS stanzas,
               (SELECT count(*) FROM content_items
                 WHERE akathist_id = a.akathist_id AND stanza_kind = 'prooimion') AS prooimia
        FROM akathists a
        LEFT JOIN memories m ON m.memory_id = a.memory_id
        WHERE a.akathist_id = ?`).get(id) as any;
    if (!head) return null;

    // item_index — порядок чтения, он и есть порядок показа. Сортировать по
    // (content_unit, stanza) было бы неверно: проимий и первый икос акростиха
    // разошлись бы по разным концам.
    const lines = db.prepare(`
        SELECT item_index, stanza_kind, content_unit, stanza, acrostic_letter, text
        FROM content_items WHERE akathist_id = ? ORDER BY item_index`).all(id) as any[];

    return {
        ...rowOf(head),
        refrainIkos: head.refrain_ikos ?? null,
        refrainKontakion: head.refrain_kontakion ?? null,
        sourceBook: head.source_book ?? null,
        sourceUrl: head.source_url ?? null,
        lines: lines.map(l => ({
            index: l.item_index,
            kind: l.stanza_kind,
            unit: l.content_unit,
            stanza: l.stanza,
            letter: l.acrostic_letter ?? null,
            text: l.text ?? "",
        })),
    };
};
