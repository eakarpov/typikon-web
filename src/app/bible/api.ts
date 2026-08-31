import clientPromise from "@/lib/mongodb";
import { cached, CacheTag } from "@/lib/cache";
import { BIBLE_CANON, canonBySection } from "@/utils/bibleCanon";
import { BIBLE_APPENDIX } from "@/utils/bibleAppendix";
import { bibleBook } from "@/utils/bibleBooks";
import { referenceChapterCount } from "@/utils/bibleVersification";
import {
    baseChapters, canonChaptersOf, chapterByBase, editionsByCodes, editionForLang,
    parallelChapter, publicEditions,
} from "@/lib/bible/query";
import { BibleEdition } from "@/lib/bible/schema";
import { DEFAULT_BIBLE_SCOPE } from "@/utils/bibleScope";
import { DEFAULT_BIBLE_EDITION_CANON } from "@/utils/bibleEditionCanon";
import type { PericopeCoverage } from "@/utils/bibleCoverage";

// Раздел Библии читает базу через тот же кэш выборок, что и остальной сайт: сами
// страницы остаются динамическими (издания выбираются в адресе и в cookie), а в
// Mongo за ними не ходим. Тег отдельный — правка издания не должна сбрасывать
// три тысячи богослужебных текстов.

/** Издание в том виде, в каком его показывают: без ObjectId и правил приведения. */
export interface EditionView {
    code: string;
    title: string;
    shortTitle: string;
    langCode: string;
    language: string;
    year: number | null;
    sourceLink: string;
    /** Объявленный объём (@/utils/bibleScope): «full», «gospels»… */
    scope: string;
    /** Сколько чтений года издание отдаёт (@/utils/bibleCoverage); меряется прогоном. */
    coverage: PericopeCoverage | null;
    /** Канон традиции (@/utils/bibleEditionCanon): «sla», «grc-lxx», «la-vulgata». */
    canon: string;
}

const toView = (edition: BibleEdition): EditionView => ({
    code: edition.code,
    title: edition.title,
    shortTitle: edition.shortTitle,
    langCode: edition.langCode,
    language: edition.language,
    year: edition.year ?? null,
    sourceLink: edition.sourceLink || "",
    scope: (edition as any).scope || DEFAULT_BIBLE_SCOPE,
    coverage: (edition as any).coverage ?? null,
    canon: (edition as any).canon || DEFAULT_BIBLE_EDITION_CANON,
});

export interface BibleIndexData {
    editions: EditionView[];
    sections: Array<{
        id: string;
        label: string;
        books: Array<{ id: string; name: string; abbr: string; chapters: number; note?: string }>;
    }>;
}

const loadIndex = async (): Promise<BibleIndexData> => {
    const db = (await clientPromise).db("typikon");

    return {
        editions: (await publicEditions(db)).map(toView),
        // Число глав берём из эталонной версификации, а не из базы: она уже в коде,
        // и оглавление канона не должно стоить семидесяти семи запросов.
        sections: [
            ...canonBySection().map((section) => ({
                id: section.id,
                label: section.label,
                books: section.books.map((book) => ({
                    id: book.id,
                    name: book.name,
                    abbr: book.abbr,
                    chapters: referenceChapterCount(book.id),
                })),
            })),
            // Приложение идёт последним и только если в нём что-то есть. Числа
            // глав у него нет: эталон собран с церковнославянского издания, а
            // этих книг в нём нет вовсе — потому они и в приложении.
            {
                id: "appendix",
                label: "Вне славянского канона",
                books: BIBLE_APPENDIX.map((book) => ({
                    id: book.id,
                    name: book.name,
                    abbr: book.abbr,
                    chapters: 0,
                    note: book.note,
                })),
            },
        ],
    };
};

export const getBibleIndex = cached(loadIndex, ["bible-index"], [CacheTag.BIBLE]);

export interface ChapterCell {
    id: string;
    /** Родная нумерация издания — как стих напечатан в книге. */
    chapter: number;
    verse: number;
    content: string;
}

export interface ChapterData {
    canonId: string;
    name: string;
    abbr: string;
    /** Номер главы: канонический в обычном виде, родной у базового издания — в его. */
    chapter: number;
    chapters: number[];
    editions: EditionView[];
    /**
     * Чьим счётом идёт страница. null — каноническим (славянским): строки суть
     * места канона, и в них попадает всё, что какое-либо издание туда кладёт.
     * Иначе — код издания, которое ведёт: строки суть ЕГО стихи в ЕГО порядке,
     * а прочие подтягиваются к ним.
     */
    base: string | null;
    rows: Array<{ canonRef: string; number: number; cells: Array<ChapterCell | null> }>;
}

const toCell = (cell: { id: string; chapter: number; verse: number; content: string } | null) =>
    cell && { id: cell.id, chapter: cell.chapter, verse: cell.verse, content: cell.content };

const loadChapter = async (
    canonId: string,
    chapter: number,
    codes: string,
    base: string,
): Promise<ChapterData | null> => {
    const canon = bibleBook(canonId);
    if (!canon) return null;

    const db = (await clientPromise).db("typikon");
    const editions = await editionsByCodes(db, codes.split(",").filter(Boolean));
    if (!editions.length) return null;

    const head = { canonId, name: canon.name, abbr: canon.abbr, editions: editions.map(toView) };

    // --- Вид в счёте базового издания
    //
    // Базой может быть только выбранное издание: вести страницу тем, чего на ней
    // нет, значило бы показывать пустые строки под чужим номером.
    const baseEdition = base ? editions.find((edition) => edition.code === base) : null;
    if (baseEdition) {
        const others = editions.filter((edition) => edition.code !== base);
        const [found, chapters] = await Promise.all([
            chapterByBase(db, baseEdition, others, canonId, chapter),
            baseChapters(db, baseEdition._id, canonId),
        ]);
        if (!found) return null;

        // Колонки идут в порядке изданий, а базовая — первой: строки ведёт она,
        // и читать их проще, когда ведущая колонка слева.
        return {
            ...head,
            editions: [baseEdition, ...others].map(toView),
            chapter,
            chapters: chapters.map((_, index) => index + 1),
            base,
            rows: found.rows.map((row) => ({
                canonRef: row.canonRef,
                number: row.number,
                cells: row.cells.map(toCell),
            })),
        };
    }

    // --- Обычный вид, в каноническом счёте
    const [rows, chapters] = await Promise.all([
        parallelChapter(db, editions, canonId, chapter),
        // Список глав — по первому изданию: это то, чью навигацию читатель видит
        // слева, и мешать в неё главы соседних изданий значило бы предлагать
        // переходы в пустоту.
        canonChaptersOf(db, editions[0]._id, canonId),
    ]);

    return {
        ...head,
        chapter,
        chapters,
        base: null,
        rows: rows.map((row) => ({
            canonRef: row.canonRef,
            number: row.number,
            cells: row.cells.map(toCell),
        })),
    };
};

export const getChapter = cached(loadChapter, ["bible-chapter"], [CacheTag.BIBLE]);

/**
 * Какие издания показывать: из адреса, а без него — то, что отвечает выбранному
 * языку. Адрес главнее cookie намеренно — по ссылке на параллельный вид должно
 * открываться то же, что видел отправитель.
 */
export const resolveEditionCodes = async (
    requested: string | undefined,
    lang: string,
): Promise<string> => {
    const fromUrl = (requested || "").split(",").map((code) => code.trim()).filter(Boolean);
    if (fromUrl.length) return fromUrl.join(",");

    const db = (await clientPromise).db("typikon");
    const edition = await editionForLang(db, lang);
    return edition?.code ?? "";
};

/** Соседняя книга канона — для перехода в конце последней главы. */
export const neighbourBooks = (canonId: string) => {
    const index = BIBLE_CANON.findIndex((book) => book.id === canonId);
    return {
        previous: index > 0 ? BIBLE_CANON[index - 1] : null,
        next: index >= 0 && index < BIBLE_CANON.length - 1 ? BIBLE_CANON[index + 1] : null,
    };
};
