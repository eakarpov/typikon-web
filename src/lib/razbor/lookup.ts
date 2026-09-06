import { rulesDb } from "@/lib/rulesDb";
import { INCIPIT_WORDS, LANGUAGES } from "@/lib/incipits";
import { readLines, type LineReport } from "@/lib/razbor/core";

// Откуда эта строка: сличение набранного с указателем зачинов.
//
// СПРАШИВАЕМ ОДНИМ ЗАПРОСОМ НА ВЕСЬ ТЕКСТ, а не по строке на каждую: у
// последования их сотня, и сотня запросов к корпусу — это сотня открытых
// планов там, где хватает одного `IN`. Указатель на 226 838 зачинов ищет по
// точному ключу, то есть по индексу, и весь текст разбирается за миллисекунды.
//
// ТОЧНОЕ СОВПАДЕНИЕ, А НЕ ПОХОЖЕЕ. Похожее пришлось бы мерить, а мера («на
// сколько букв разошлось») превращает ответ «это вот эта стихира» в ответ
// «это, наверное, она» — и наборщик перестаёт ему верить. Не нашлось — значит
// не нашлось: либо опечатка, либо текст не из нашего собрания, и оба ответа
// полезнее вежливой догадки.

/** Приписанный к началу наибольший знак: всё, что с него начинается, меньше. */
const UPPER_BOUND = String.fromCodePoint(0x10ffff);

export interface Found {
    itemId: number;
    /**
     * Строка короче шести слов: указатель хранит зачины по шесть, и такая
     * строка сличается началом, а не целиком. Совпадений тогда бывает много,
     * и находка это не «вот эта стихира», а «зачинов, начинающихся так, —
     * столько-то».
     */
    byPrefix: boolean;
    language: string;
    /** Что это за строка: род, книга, память — то же, что на карточке зачина. */
    unit: string | null;
    book: string | null;
    memory: string | null;
    /** Сколько раз этот зачин встречается в собрании. */
    witnesses: number;
}

export interface RazborLine extends LineReport {
    found: Found | null;
}

export interface Razbor {
    lines: RazborLine[];
    /** Корпуса на сервере нет — сличать не с чем, и это не «ничего не нашлось». */
    corpusMissing: boolean;
    summary: {
        lines: number;
        found: number;
        flagged: number;
    };
}

export const razbor = (text: string): Razbor => {
    const lines = readLines(text);
    const db = rulesDb();

    const empty = (corpusMissing: boolean): Razbor => ({
        lines: lines.map(line => ({ ...line, found: null })),
        corpusMissing,
        summary: {
            lines: lines.length,
            found: 0,
            flagged: lines.filter(l => l.flags.length).length,
        },
    });

    if (!db) return empty(true);

    const keys = [...new Set(lines.map(l => l.key).filter(Boolean))];
    if (!keys.length) return empty(false);

    // Язык не спрашиваем у человека: набранное сличается со всеми сразу, и
    // румынская строка найдётся румынской. Спросить значило бы переложить на
    // наборщика вопрос, на который указатель отвечает сам.
    const langList = LANGUAGES.map(() => "?").join(", ");
    const keyList = keys.map(() => "?").join(", ");

    const rows = db.prepare(`
        WITH hits AS (
            SELECT ti.incipit AS key, ti.language AS language,
                   min(ti.item_id) AS item_id, count(*) AS witnesses
            FROM text_incipits ti
            WHERE ti.language IN (${langList}) AND ti.incipit IN (${keyList})
            GROUP BY ti.incipit, ti.language
        )
        SELECT h.key, h.language, h.item_id, h.witnesses,
               ci.content_unit AS unit, m.book AS book, m.label AS memory
        FROM hits h
        JOIN content_items ci ON ci.item_id = h.item_id
        LEFT JOIN groups g ON g.group_id = ci.group_id
        LEFT JOIN canons c ON c.canon_id = ci.canon_id
        LEFT JOIN akathists a ON a.akathist_id = ci.akathist_id
        LEFT JOIN memories m ON m.memory_id = COALESCE(g.memory_id, c.memory_id, a.memory_id)
    `).all(...LANGUAGES, ...keys) as any[];

    // Один ключ может найтись на нескольких языках; берём первое совпадение —
    // язык виден в самой находке, и спорить тут не о чем.
    const byKey = new Map<string, Found>();
    for (const row of rows) {
        if (byKey.has(row.key)) continue;
        byKey.set(row.key, {
            itemId: row.item_id,
            byPrefix: false,
            language: row.language,
            unit: row.unit ?? null,
            book: row.book ?? null,
            memory: row.memory ?? null,
            witnesses: row.witnesses,
        });
    }

    // КОРОТКУЮ СТРОКУ ИЩЕМ НАЧАЛОМ. Указатель хранит зачины по шесть слов, и
    // «Го́споди, поми́луй на́с» точным совпадением не найдётся никогда: в ключе
    // три слова, а в указателе шесть. Такие ищем диапазоном по индексу — тем
    // же приёмом, каким устроен сам указатель зачинов.
    const short = keys.filter(key => key.split(" ").length < INCIPIT_WORDS);
    // Каждая короткая строка стоит своего запроса; десятка довольно, чтобы
    // разобрать ектению, и мало, чтобы кто-то занял собою базу.
    for (const key of short.slice(0, 10)) {
        if (byKey.has(key)) continue;
        const row = db.prepare(`
            SELECT count(*) AS witnesses, min(ti.item_id) AS item_id, min(ti.language) AS language
            FROM text_incipits ti
            WHERE ti.language IN (${langList}) AND ti.incipit >= ? AND ti.incipit < ?
        `).get(...LANGUAGES, key, key + UPPER_BOUND) as any;
        if (!row?.witnesses) continue;

        const about = db.prepare(`
            SELECT ci.content_unit AS unit, m.book AS book, m.label AS memory
            FROM content_items ci
            LEFT JOIN groups g ON g.group_id = ci.group_id
            LEFT JOIN canons c ON c.canon_id = ci.canon_id
            LEFT JOIN akathists a ON a.akathist_id = ci.akathist_id
            LEFT JOIN memories m ON m.memory_id = COALESCE(g.memory_id, c.memory_id, a.memory_id)
            WHERE ci.item_id = ?
        `).get(row.item_id) as any;

        byKey.set(key, {
            itemId: row.item_id,
            byPrefix: true,
            language: row.language,
            unit: about?.unit ?? null,
            book: about?.book ?? null,
            memory: about?.memory ?? null,
            witnesses: row.witnesses,
        });
    }

    const out = lines.map(line => ({ ...line, found: byKey.get(line.key) ?? null }));

    return {
        lines: out,
        corpusMissing: false,
        summary: {
            lines: out.length,
            found: out.filter(l => l.found).length,
            flagged: out.filter(l => l.flags.length).length,
        },
    };
};
