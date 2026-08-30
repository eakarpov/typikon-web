import clientPromise from "@/lib/mongodb";
import { cached, CacheTag } from "@/lib/cache";
import { BIBLE_CANON, canonBook, canonBySection } from "@/utils/bibleCanon";
import { referenceChapterCount } from "@/utils/bibleVersification";
import {
    canonChaptersOf, editionsByCodes, editionForLang, parallelChapter, publicEditions,
} from "@/lib/bible/query";
import { BibleEdition } from "@/lib/bible/schema";

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
}

const toView = (edition: BibleEdition): EditionView => ({
    code: edition.code,
    title: edition.title,
    shortTitle: edition.shortTitle,
    langCode: edition.langCode,
    language: edition.language,
    year: edition.year ?? null,
    sourceLink: edition.sourceLink || "",
});

export interface BibleIndexData {
    editions: EditionView[];
    sections: Array<{
        id: string;
        label: string;
        books: Array<{ id: string; name: string; abbr: string; chapters: number }>;
    }>;
}

const loadIndex = async (): Promise<BibleIndexData> => {
    const db = (await clientPromise).db("typikon");

    return {
        editions: (await publicEditions(db)).map(toView),
        // Число глав берём из эталонной версификации, а не из базы: она уже в коде,
        // и оглавление канона не должно стоить семидесяти семи запросов.
        sections: canonBySection().map((section) => ({
            id: section.id,
            label: section.label,
            books: section.books.map((book) => ({
                id: book.id,
                name: book.name,
                abbr: book.abbr,
                chapters: referenceChapterCount(book.id),
            })),
        })),
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
    chapter: number;
    chapters: number[];
    editions: EditionView[];
    rows: Array<{ canonRef: string; canonVerse: number; cells: Array<ChapterCell | null> }>;
}

const loadChapter = async (
    canonId: string,
    chapter: number,
    codes: string,
): Promise<ChapterData | null> => {
    const canon = canonBook(canonId);
    if (!canon) return null;

    const db = (await clientPromise).db("typikon");
    const editions = await editionsByCodes(db, codes.split(",").filter(Boolean));
    if (!editions.length) return null;

    const [rows, chapters] = await Promise.all([
        parallelChapter(db, editions, canonId, chapter),
        // Список глав — по первому изданию: это то, чью навигацию читатель видит
        // слева, и мешать в неё главы соседних изданий значило бы предлагать
        // переходы в пустоту.
        canonChaptersOf(db, editions[0]._id, canonId),
    ]);

    return {
        canonId,
        name: canon.name,
        abbr: canon.abbr,
        chapter,
        chapters,
        editions: editions.map(toView),
        rows: rows.map((row) => ({
            canonRef: row.canonRef,
            canonVerse: row.canonVerse,
            cells: row.cells.map((cell) => cell && {
                id: cell.id,
                chapter: cell.chapter,
                verse: cell.verse,
                content: cell.content,
            }),
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
