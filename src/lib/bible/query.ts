// Запросы к Библии: издания, книги, стихи.
//
// Здесь единственное место, которое знает, как отрезок канона превращается в
// запрос к Mongo. Всё остальное — резолюция зачал, раздел Библии, публичное API —
// ходит сюда, чтобы правило «искать по канонической нумерации, показывать
// родную» не пришлось повторять в каждом месте по-своему.
//
// Кэширование не здесь: вызывающие уже завёрнуты в `cached` (@/lib/cache) со
// своими тегами, и второй слой кэша поверх них только мешал бы сбросу.
import { Db, ObjectId } from "mongodb";
import { IVerseRange } from "@/utils/verses";
import { rangesToCanonSortFilter } from "@/lib/bible/refs";
import { BibleBook, BibleEdition, BIBLE_BOOKS, BIBLE_EDITIONS, BIBLE_VERSES } from "@/lib/bible/schema";

/** Стих в том виде, в каком его показывают: содержимое плюс обе нумерации. */
export interface ResolvedVerse {
    id: string;
    /** Книга издания, в которой стих напечатан: одна книга канона может собираться из нескольких. */
    bookId: ObjectId;
    /** Родная нумерация издания — она напечатана в книге. */
    chapter: number;
    verse: number;
    /** Каноническая — по ней стих сходится с другими изданиями. */
    canonChapter: number;
    canonVerse: number;
    canonRef: string;
    content: string;
}

const toResolved = (doc: any): ResolvedVerse => ({
    id: doc._id.toString(),
    bookId: doc.bookId,
    chapter: doc.chapter,
    verse: doc.verse,
    canonChapter: doc.canonChapter,
    canonVerse: doc.canonVerse,
    canonRef: doc.canonRef,
    content: doc.content ?? "",
});

export const editionByCode = async (db: Db, code: string): Promise<BibleEdition | null> =>
    db.collection(BIBLE_EDITIONS).findOne({ code }) as Promise<BibleEdition | null>;

/**
 * Издание, которым отвечает выбранный язык. Изданий на язык может быть несколько,
 * поэтому берём помеченное по умолчанию, а без пометки — первое по порядку: пусть
 * лучше ответит не то издание, чем чтение пропадёт из-за незаполненного флага.
 */
export const editionForLang = async (db: Db, langCode: string): Promise<BibleEdition | null> =>
    db.collection(BIBLE_EDITIONS).findOne(
        { langCode },
        { sort: { isDefaultForLang: -1, order: 1 } },
    ) as Promise<BibleEdition | null>;

export const publicEditions = async (db: Db): Promise<BibleEdition[]> =>
    db.collection(BIBLE_EDITIONS)
        .find({ public: { $ne: false } })
        .sort({ order: 1 })
        .toArray() as Promise<BibleEdition[]>;

export const editionsByCodes = async (db: Db, codes: string[]): Promise<BibleEdition[]> => {
    if (!codes.length) return [];
    const found = await db.collection(BIBLE_EDITIONS)
        .find({ code: { $in: codes }, public: { $ne: false } })
        .toArray() as BibleEdition[];

    // Порядок задаёт запрос, а не база: колонки в параллельном виде должны стоять
    // так, как их перечислил читатель в адресе.
    const byCode = new Map(found.map((edition) => [edition.code, edition]));
    return codes.map((code) => byCode.get(code)).filter(Boolean) as BibleEdition[];
};

/** Книги издания, легшие в книгу канона. Обычно одна; у румынского Даниила — четыре. */
export const booksForCanon = async (
    db: Db,
    editionId: ObjectId,
    canonId: string,
): Promise<BibleBook[]> =>
    db.collection(BIBLE_BOOKS)
        .find({ editionId, canonId })
        .sort({ order: 1 })
        .toArray() as Promise<BibleBook[]>;

export const bookByAlias = async (db: Db, alias: string): Promise<BibleBook | null> =>
    db.collection(BIBLE_BOOKS).findOne({ alias }) as Promise<BibleBook | null>;

/**
 * Стихи отрезка канона в одном издании.
 *
 * Пустой список диапазонов означает книгу целиком — так же, как его понимает
 * filterVersesByRanges (@/utils/verses).
 *
 * Порядок — канонический, а не тот, в каком стихи напечатаны: чтение идёт по
 * уставу, и если издание разнесло песнь трёх отроков в отдельную книгу, в чтении
 * она всё равно должна стоять посреди третьей главы Даниила.
 */
export const versesForCanonRanges = async (
    db: Db,
    editionId: ObjectId,
    canonId: string,
    ranges: IVerseRange[] | null | undefined,
): Promise<ResolvedVerse[]> => {
    const rangeFilter = rangesToCanonSortFilter(ranges);

    const docs = await db.collection(BIBLE_VERSES)
        .find({ editionId, canonId, ...(rangeFilter ?? {}) })
        .sort({ canonSort: 1 })
        .toArray();

    return docs.map(toResolved);
};

/** Глава канона в одном издании — тот же запрос, только диапазон известен заранее. */
export const versesForCanonChapter = async (
    db: Db,
    editionId: ObjectId,
    canonId: string,
    chapter: number,
): Promise<ResolvedVerse[]> =>
    versesForCanonRanges(db, editionId, canonId, [
        { chapterFrom: chapter, verseFrom: 1, chapterTo: chapter, verseTo: Number.MAX_SAFE_INTEGER },
    ]);

/** Какие главы канона есть у книги в этом издании — для оглавления. */
export const canonChaptersOf = async (
    db: Db,
    editionId: ObjectId,
    canonId: string,
): Promise<number[]> => {
    const chapters = await db.collection(BIBLE_VERSES).distinct("canonChapter", { editionId, canonId });
    return (chapters as number[]).sort((a, b) => a - b);
};

/**
 * Одна глава канона сразу в нескольких изданиях, сведённая по каноническому ключу.
 *
 * Возвращает строки в каноническом порядке; в строке — по ячейке на издание, и
 * ячейка пуста там, где у издания такого стиха нет. Пустая ячейка — не ошибка:
 * у румынской Псалтири в девятом псалме на стих меньше, чем у славянской, и честнее
 * показать пробел, чем сдвинуть соседние строки.
 */
export const parallelChapter = async (
    db: Db,
    editions: BibleEdition[],
    canonId: string,
    chapter: number,
): Promise<Array<{ canonRef: string; canonVerse: number; cells: Array<ResolvedVerse | null> }>> => {
    if (!editions.length) return [];

    const editionIds = editions.map((edition) => edition._id);
    const docs = await db.collection(BIBLE_VERSES)
        .find({ editionId: { $in: editionIds }, canonId, canonChapter: chapter })
        .sort({ canonSort: 1 })
        .toArray();

    const byRef = new Map<string, { canonVerse: number; cells: Map<string, ResolvedVerse> }>();
    docs.forEach((doc) => {
        const row = byRef.get(doc.canonRef) ?? { canonVerse: doc.canonVerse, cells: new Map() };
        // Одна книга канона может собираться из нескольких книг издания, и на один
        // канонический стих их вклад не должен накладываться. Первый выигрывает —
        // порядок задан сортировкой по canonSort, то есть порядком чтения.
        if (!row.cells.has(doc.editionId.toString())) {
            row.cells.set(doc.editionId.toString(), toResolved(doc));
        }
        byRef.set(doc.canonRef, row);
    });

    return [...byRef.entries()]
        .sort((a, b) => a[1].canonVerse - b[1].canonVerse)
        .map(([canonRef, row]) => ({
            canonRef,
            canonVerse: row.canonVerse,
            cells: editionIds.map((id) => row.cells.get(id.toString()) ?? null),
        }));
};

/**
 * Книга издания по её прежнему адресу чтения, вместе с первой канонической главой.
 *
 * Нужно для постоянного редиректа со старых `/reading/biblia-*`: адрес называет
 * книгу издания, а раздел Библии устроен по канону, и для «Истории Сусанны»
 * правильная цель — не первая глава, а тринадцатая глава Даниила.
 */
export const bibleRedirectTarget = async (
    db: Db,
    idOrAlias: string,
): Promise<{ canonId: string; chapter: number; editionCode: string } | null> => {
    const filter = ObjectId.isValid(idOrAlias)
        ? { _id: new ObjectId(idOrAlias) }
        : { alias: idOrAlias };

    const book = await db.collection(BIBLE_BOOKS).findOne(filter) as BibleBook | null;
    if (!book) return null;

    const first = await db.collection(BIBLE_VERSES).findOne(
        { bookId: book._id },
        { sort: { canonSort: 1 }, projection: { canonChapter: 1 } },
    );

    const edition = await db.collection(BIBLE_EDITIONS).findOne(
        { _id: book.editionId },
        { projection: { code: 1 } },
    );

    return {
        canonId: book.canonId,
        chapter: (first?.canonChapter as number) ?? 1,
        editionCode: (edition?.code as string) ?? "",
    };
};
