import clientPromise from "@/lib/mongodb";
import { BIBLE_BOOKS, BIBLE_EDITIONS, BIBLE_VERSES } from "@/lib/bible/schema";
import { canonBookName } from "@/utils/bibleCanon";

// Админский список изданий с их книгами. Без кэша: редактор должен видеть то, что
// в базе прямо сейчас, а не то, что успело осесть в кэше выборок.

export interface AdminBook {
    id: string;
    slug: string;
    canonId: string;
    canonName: string;
    name: string;
    alias: string;
    order: number;
    verses: number;
    chapters: number;
    /** Книга издания легла не туда, где стоит её слуг, — то есть сработало правило. */
    remapped: boolean;
}

export interface AdminEdition {
    id: string;
    code: string;
    title: string;
    shortTitle: string;
    langCode: string;
    language: string;
    isDefaultForLang: boolean;
    versification: string;
    year: number | null;
    sourceLink: string;
    order: number;
    public: boolean;
    /** Правила приведения к канону — показываем, но не даём править: они в гите. */
    mapping: Array<{ note: string; exact: boolean }>;
    books: AdminBook[];
}

export const getEditions = async (): Promise<AdminEdition[]> => {
    try {
        const db = (await clientPromise).db("typikon");

        const editions = await db.collection(BIBLE_EDITIONS).find({}).sort({ order: 1 }).toArray();

        // Стихи считаем одной агрегацией на всё, а не запросом на книгу: книг 156,
        // и полтораста обращений ради одной страницы админки — плохой обмен.
        const counts = await db.collection(BIBLE_VERSES).aggregate([
            { $group: { _id: "$bookId", verses: { $sum: 1 }, chapters: { $addToSet: "$canonChapter" } } },
        ]).toArray();
        const byBook = new Map(counts.map((row) => [
            row._id.toString(),
            { verses: row.verses as number, chapters: (row.chapters as number[]).length },
        ]));

        const books = await db.collection(BIBLE_BOOKS).find({}).sort({ order: 1 }).toArray();

        return editions.map((edition) => ({
            id: edition._id.toString(),
            code: edition.code,
            title: edition.title ?? "",
            shortTitle: edition.shortTitle ?? "",
            langCode: edition.langCode ?? "",
            language: edition.language ?? "",
            isDefaultForLang: Boolean(edition.isDefaultForLang),
            versification: edition.versification ?? "",
            year: edition.year ?? null,
            sourceLink: edition.sourceLink ?? "",
            order: edition.order ?? 0,
            public: edition.public !== false,
            mapping: (edition.mapping || []).map((rule: any) => ({
                note: rule.note ?? "",
                exact: Boolean(rule.exact),
            })),
            books: books
                .filter((book) => book.editionId.toString() === edition._id.toString())
                .map((book) => {
                    const count = byBook.get(book._id.toString());
                    return {
                        id: book._id.toString(),
                        slug: book.slug,
                        canonId: book.canonId,
                        canonName: canonBookName(book.canonId),
                        name: book.name ?? "",
                        alias: book.alias ?? "",
                        order: book.order ?? 0,
                        verses: count?.verses ?? 0,
                        chapters: count?.chapters ?? 0,
                        remapped: book.slug !== book.canonId,
                    };
                }),
        }));
    } catch (e) {
        console.error(e);
        return [];
    }
};
