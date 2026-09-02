import { rulesDb } from "@/lib/rulesDb";
import { conditionsFor, type ChantFilters, type ChantHit, type SnippetPart } from "@/lib/chants";
import { canonSort, parseKnownCanonRef } from "@/lib/bible/refs";

/**
 * Отзвуки Писания в богослужебном тексте.
 *
 * Богослужебный текст соткан из Писания: стихира почти целиком собрана из
 * чужих фраз, и это приём, а не случайность. Слой считается не здесь, а в
 * соседнем проекте (typikon-rules/src/migrate_scripture_citations.py), и
 * приезжает готовой таблицей `scripture_citations`. Веб только показывает.
 *
 * ЧТО ЛЕЖИТ В ТАБЛИЦЕ. На каждую цитату — адрес стиха (`canon_ref`, тот же
 * ключ, что у стихов Библии в Монге), смещения в ИСХОДНОМ тексте строки,
 * длина совпадения в словах и уверенность. Уверенное совпадение — от пяти
 * слов подряд; короткое помечено `candidate`, потому что богослужебный язык
 * формулен и три слова подряд («во веки веков») не значат ничего.
 *
 * ПОЧЕМУ СМЕЩЕНИЯ, А НЕ ПОИСК ПОДСТРОКИ. Искать цитату в тексте заново
 * значило бы повторить в TypeScript нормализацию церковнославянского,
 * которая и посчитала эти смещения. Смещения приходят готовыми, и задача
 * веба — разрезать по ним строку, ничего не сдвинув.
 */

/** Одно утверждение о том, что кусок строки взят из Писания. */
export interface Citation {
    /** 'psaltir.117.22' — канонический адрес стиха. */
    canonRef: string;
    /** Он же разобранный: страницы не должны разбирать его сами. */
    canonId: string;
    chapter: number;
    verse: number;
    canonSort: number;
    /** Смещения в исходном тексте строки. */
    start: number;
    end: number;
    /** Длина совпадения в словах — она же вес цитаты. */
    words: number;
    confidence: "certain" | "candidate";
    method: "ngram" | "manual";
}

/** Кусок текста после раскладки: либо простой, либо накрытый цитатами. */
export interface CitationPart {
    text: string;
    /** Стихи, накрывающие кусок. Пусто — это не цитата. */
    refs: Citation[];
    /** Хотя бы одна из накрывающих названа уверенно. */
    certain: boolean;
    /** Разрыв строки, напечатанный книгой (косая черта). */
    break?: boolean;
}

// Слой цитат появился в корпусе позже самого корпуса, и выложен он не на
// всяком сервере: rules-db-release.sh везёт файл целиком, но выкладка могла
// отстать от сборки. Спрашивать таблицу, которой нет, — уронить песнопение
// ради подсветки под ним. Тот же приём, что у hasAuthors в @/lib/canons.
let citationsAvailable: boolean | undefined;
const hasCitations = (db: any): boolean => {
    if (citationsAvailable === undefined) {
        citationsAvailable = !!db.prepare(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'scripture_citations'",
        ).get();
    }
    return citationsAvailable;
};

const toCitation = (row: any): Citation | null => {
    const parsed = parseKnownCanonRef(row.canon_ref);
    if (!parsed) return null;
    const start = Number(row.span_start);
    const end = Number(row.span_end);
    if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) return null;
    return {
        canonRef: row.canon_ref,
        canonId: parsed.canonId,
        chapter: parsed.chapter,
        verse: parsed.verse,
        canonSort: Number(row.canon_sort),
        start,
        end,
        words: Number(row.words),
        confidence: row.confidence,
        method: row.method,
    };
};

/**
 * Цитаты одной строки корпуса.
 *
 * null — корпуса нет вовсе (то же соглашение, что у searchChants).
 * Пустой список — либо слоя цитат нет, либо в этой строке их не нашли; для
 * показа это одно и то же, а различить их можно по citationsLayer().
 */
export const citationsOf = (itemId: number | null | undefined): Citation[] | null => {
    const db = rulesDb();
    if (!db) return null;
    if (!itemId || !hasCitations(db)) return [];

    const rows = db.prepare(`
        SELECT canon_ref, canon_sort, span_start, span_end, words, confidence, method
          FROM scripture_citations
         WHERE item_id = ?
         ORDER BY span_start, words DESC, canon_sort
    `).all(itemId) as any[];

    return rows.map(toCitation).filter((c): c is Citation => c !== null);
};

/** Есть ли слой цитат в выложенном корпусе вообще. */
export const citationsLayer = (): boolean => {
    const db = rulesDb();
    return !!db && hasCitations(db);
};

/**
 * Разложить текст песнопения на куски по цитатам и разрывам строк.
 *
 * ЗАМЕТАНИЕ ПО ГРАНИЦАМ, А НЕ ВЛОЖЕНИЕ. Цитаты перекрываются, и все три
 * случая — правда, а не сбой разбора:
 *
 *   совпадающие спаны, разные стихи — «ка́мень, его́же небрего́ша» есть и в
 *     Пс. 117:22, и в Мф. 21:42: один кусок, два адреса, текст не дробится;
 *   частичное наложение — два совпадения делят слово: три куска;
 *   вложение — длинная цитата и внутри неё короткая: три куска.
 *
 * Нарисовать каждую цитату своим элементом при частичном наложении в DOM
 * невыразимо вообще. Плоские куски — единственная модель, которая ложится в
 * разметку; «здесь сошлись два стиха» несёт длина refs, а не вложенность.
 *
 * КОСАЯ ЧЕРТА — такая же граница, как спан. Строка песнопения короче стиха
 * псалма, и цитата разрыв пересекает сплошь и рядом: тогда выходят два
 * куска с одними и теми же refs и break между ними, то есть подсветка
 * продолжается на следующей строке. Так и должно быть.
 *
 * ИНВАРИАНТ: parts.map(p => p.break ? "/" : p.text).join("") === text.
 * Из него следует, что резать и подрезать здесь нечего: .trim() строк —
 * дело показа, а не раскладки, иначе подсветка уедет на символ.
 */
export const layoutCitations = (
    text: string,
    citations: Citation[] | null | undefined,
): CitationPart[] => {
    if (!text) return [];

    // Входу не доверяем: смещения приходят из базы, а база — с другой машины.
    const spans = (citations ?? []).filter(
        c => Number.isInteger(c.start) && Number.isInteger(c.end)
            && c.start >= 0 && c.end > c.start && c.start < text.length,
    ).map(c => ({ ...c, end: Math.min(c.end, text.length) }));

    // Один адрес на одном спане — одно утверждение, даже если база отдала
    // его дважды.
    const unique = new Map<string, Citation>();
    spans.forEach((c) => {
        const key = `${c.start}:${c.end}:${c.canonRef}`;
        const kept = unique.get(key);
        if (!kept || (kept.confidence !== "certain" && c.confidence === "certain")) {
            unique.set(key, c);
        }
    });
    const marks = [...unique.values()];

    const breaks: number[] = [];
    for (let i = text.indexOf("/"); i >= 0; i = text.indexOf("/", i + 1)) breaks.push(i);

    const points = new Set<number>([0, text.length]);
    marks.forEach((c) => { points.add(c.start); points.add(c.end); });
    breaks.forEach((i) => { points.add(i); points.add(i + 1); });
    const edges = [...points].sort((a, b) => a - b);

    const out: CitationPart[] = [];
    for (let i = 0; i < edges.length - 1; i++) {
        const from = edges[i];
        const to = edges[i + 1];
        if (to <= from) continue;

        if (breaks.includes(from) && to === from + 1) {
            out.push({ text: "/", refs: [], certain: false, break: true });
            continue;
        }

        const refs = marks
            .filter(c => c.start <= from && c.end >= to)
            .sort((a, b) => (b.words - a.words) || (a.canonSort - b.canonSort));

        const part: CitationPart = {
            text: text.slice(from, to),
            refs,
            certain: refs.some(c => c.confidence === "certain"),
        };

        // Слить с предыдущим, если стихи те же: совпавшие границы двух цитат
        // иначе оставляли бы в тексте ложный шов.
        const last = out[out.length - 1];
        if (last && !last.break && sameRefs(last.refs, part.refs)) {
            last.text += part.text;
        } else {
            out.push(part);
        }
    }
    return out;
};

const sameRefs = (a: Citation[], b: Citation[]): boolean =>
    a.length === b.length && a.every((c, i) => c.canonRef === b[i].canonRef);

/** Все стихи строки, от самой длинной цитаты к самой короткой. */
export const citedVerses = (citations: Citation[] | null | undefined): Citation[] =>
    [...(citations ?? [])].sort(
        (a, b) => (b.words - a.words) || (a.canonSort - b.canonSort),
    );

/** Адрес стиха у нас: /bible/psaltir/117#v22 */
export const verseHref = (c: Pick<Citation, "canonId" | "chapter" | "verse">): string =>
    `/bible/${c.canonId}/${c.chapter}#v${c.verse}`;

/** Адрес отзвуков стиха: где ещё это место звучит. */
export const echoesHref = (c: Pick<Citation, "canonId" | "chapter" | "verse">): string =>
    `/bible/${c.canonId}/${c.chapter}/${c.verse}`;

/**
 * Границы по canonSort: для одного стиха — он сам, для главы — весь её
 * отрезок. Считается той же формулой, что и canonSort в базе, иначе две
 * формулы однажды разойдутся.
 */
export const canonSortRange = (chapter: number, verse?: number | null): [number, number] =>
    verse
        ? [canonSort(chapter, verse), canonSort(chapter, verse)]
        : [canonSort(chapter, 1), canonSort(chapter, 99999)];

/**
 * Отзвук стиха: строка корпуса, в которой он звучит, вместе с фрагментом.
 *
 * Форма фрагмента — та же SnippetPart[], что у выдачи поиска, чтобы карточку
 * рисовал тот же компонент и они не разошлись со временем.
 */
export interface Echo extends Omit<ChantHit, "snippet"> {
    snippet: SnippetPart[];
    canonRef: string;
    chapter: number;
    verse: number;
    words: number;
    confidence: "certain" | "candidate";
}

export interface EchoFilters extends ChantFilters {
    /** Только уверенные совпадения. По умолчанию — да. */
    certainOnly?: boolean | null;
}

/**
 * Окно вокруг цитаты в том же виде, что отдаёт поиск.
 *
 * Границы двигаются до ближайшего пробела: резать посреди слова нельзя, а
 * добавлять многоточие внутрь слова — тем более. Косые черты внутри окна
 * становятся пробелом: в карточке разрывов певческих строк не рисуем.
 */
export const citationSnippet = (
    text: string, start: number, end: number, context = 40,
): SnippetPart[] => {
    if (!text) return [];
    const from = Math.max(0, Math.min(start, text.length));
    const to = Math.max(from, Math.min(end, text.length));

    let left = Math.max(0, from - context);
    while (left > 0 && !/\s|\//.test(text[left - 1])) left--;
    let right = Math.min(text.length, to + context);
    while (right < text.length && !/\s|\//.test(text[right])) right++;

    const clean = (s: string) => s.replace(/\//g, " ").replace(/\s{2,}/g, " ");
    const parts: SnippetPart[] = [];
    const head = (left > 0 ? "…" : "") + clean(text.slice(left, from));
    if (head) parts.push({ text: head, hit: false });
    const body = clean(text.slice(from, to));
    if (body) parts.push({ text: body, hit: true });
    const tail = clean(text.slice(to, right)) + (right < text.length ? "…" : "");
    if (tail) parts.push({ text: tail, hit: false });
    return parts;
};

/**
 * Где ещё звучит это место Писания.
 *
 * Отбираем и отрезаем страницу ДО соединений — по той же причине, что и в
 * searchChants: у ходового стиха отзвуков сотни, и соединять их все с
 * памятями, позициями и знаками ради двадцати показанных значит потратить
 * полсекунды впустую.
 *
 * Порядок свой: длинное дословное совпадение вперёд, догадка позади. Ранга
 * bm25 здесь нет — запроса-то и нет, есть адрес стиха.
 */
export const echoesOf = (
    canonId: string,
    from: number,
    to: number,
    filters: EchoFilters = {},
    limit = 20,
    offset = 0,
): { items: Echo[]; total: number } | null => {
    const db = rulesDb();
    if (!db) return null;
    if (!hasCitations(db)) return { items: [], total: 0 };

    const conditions = conditionsFor(filters);
    if (filters.certainOnly !== false) conditions.push({ sql: "x.confidence = 'certain'" });
    const needsSign = conditions.some(c => c.sql.startsWith("s."));
    const where = conditions.map(c => c.sql).join(" AND ");
    const values = conditions.flatMap(c => (c.value === undefined ? [] : [c.value]));

    const source = `
        FROM scripture_citations x
        JOIN content_items ci ON ci.item_id = x.item_id
        LEFT JOIN groups g ON g.group_id = ci.group_id
        LEFT JOIN canons c ON c.canon_id = ci.canon_id
        LEFT JOIN memories m ON m.memory_id = COALESCE(g.memory_id, c.memory_id)
        ${needsSign ? "LEFT JOIN memory_signs s ON s.memory_id = m.memory_id" : ""}
        WHERE x.canon_id = ? AND x.canon_sort BETWEEN ? AND ?
        ${where ? `AND ${where}` : ""}`;

    const total = db.prepare(`SELECT count(*) AS n ${source}`)
        .get(canonId, from, to, ...values) as { n: number };

    const rows = db.prepare(`
        WITH hits AS (
            SELECT x.item_id, x.canon_ref, x.canon_sort, x.span_start, x.span_end,
                   x.words, x.confidence
            ${source}
            ORDER BY x.words DESC, x.confidence, x.item_id
            LIMIT ? OFFSET ?
        )
        SELECT h.*, ci.text, ci.content_unit, ci.ode, ci.marker, ci.placement,
               ci.language, ci.stanza, ci.stanza_kind,
               m.memory_id, m.label AS memory_label, m.book, m.month, m.day,
               COALESCE(g.service, c.service) AS service,
               COALESCE(g.tone, c.tone) AS tone,
               p.label AS position_label,
               s.default_sign AS sign,
               a.title AS akathist_title, g.source_book
        FROM hits h
        JOIN content_items ci ON ci.item_id = h.item_id
        LEFT JOIN groups g ON g.group_id = ci.group_id
        LEFT JOIN canons c ON c.canon_id = ci.canon_id
        LEFT JOIN akathists a ON a.akathist_id = ci.akathist_id
        LEFT JOIN memories m ON m.memory_id = COALESCE(g.memory_id, c.memory_id)
        LEFT JOIN positions p ON p.position_id = COALESCE(g.position_id, c.position_id)
        LEFT JOIN memory_signs s ON s.memory_id = m.memory_id
        ORDER BY h.words DESC, h.confidence, h.item_id
    `).all(canonId, from, to, ...values, limit, offset) as any[];

    return {
        total: total?.n ?? 0,
        items: rows.map((r) => {
            const parsed = parseKnownCanonRef(r.canon_ref);
            return {
                id: r.item_id,
                snippet: citationSnippet(r.text ?? "", r.span_start, r.span_end),
                canonRef: r.canon_ref,
                chapter: parsed?.chapter ?? 0,
                verse: parsed?.verse ?? 0,
                words: r.words,
                confidence: r.confidence,
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
            };
        }),
    };
};

/**
 * Сколько песнопений отзывается на каждый стих главы — для пометок в самой
 * главе. Ключ — номер стиха по канонической нумерации.
 */
export const echoCountsForChapter = (
    canonId: string, chapter: number,
): Record<number, number> | null => {
    const db = rulesDb();
    if (!db) return null;
    if (!hasCitations(db)) return {};

    const [from, to] = canonSortRange(chapter);
    const rows = db.prepare(`
        SELECT canon_sort, count(*) AS n
          FROM scripture_citations
         WHERE canon_id = ? AND canon_sort BETWEEN ? AND ? AND confidence = 'certain'
         GROUP BY canon_sort
    `).all(canonId, from, to) as Array<{ canon_sort: number; n: number }>;

    const out: Record<number, number> = {};
    rows.forEach(r => { out[r.canon_sort % 100000] = r.n; });
    return out;
};
