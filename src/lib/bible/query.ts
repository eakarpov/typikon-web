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

/**
 * Глава канона в одном издании.
 *
 * Спрашивает canonChapter НАПРЯМУЮ, а не диапазоном по canonSort. Через диапазон
 * было бы естественнее — тот же путь, что у зачал, — но верхней границей пришлось
 * бы брать «последний стих главы», а он заранее не известен. Number.MAX_SAFE_INTEGER
 * на эту роль не годится: свёртка `глава * 100000 + стих` (@/utils/verses) от такого
 * стиха даёт число больше любого следующего ГЛАВЫ, и запрос молча отдавал бы главу
 * вместе со всем остатком книги.
 */
export const versesForCanonChapter = async (
    db: Db,
    editionId: ObjectId,
    canonId: string,
    chapter: number,
): Promise<ResolvedVerse[]> => {
    const docs = await db.collection(BIBLE_VERSES)
        .find({ editionId, canonId, canonChapter: chapter })
        .sort({ canonSort: 1 })
        .toArray();

    return docs.map(toResolved);
};

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
export interface ParallelRow {
    canonRef: string;
    /** Номер, под которым строка показывается: в каноническом виде — канонический. */
    number: number;
    cells: Array<ResolvedVerse | null>;
}

export const parallelChapter = async (
    db: Db,
    editions: BibleEdition[],
    canonId: string,
    chapter: number,
): Promise<ParallelRow[]> => {
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
            number: row.canonVerse,
            cells: editionIds.map((id) => row.cells.get(id.toString()) ?? null),
        }));
};

/**
 * Главы книги В СЧЁТЕ ИЗДАНИЯ — то есть так, как они в нём напечатаны.
 *
 * Отличается от canonChaptersOf принципиально: та отдаёт главы КАНОНА, и у
 * греческих Притчей их выходит 31, хотя издание печатает 29. Здесь наоборот —
 * что напечатано, то и отдаётся.
 *
 * Одну книгу канона издание может собирать из нескольких своих (греческий
 * Даниил — из Даниила, Сусанны и Вила), и номер главы у них начинается заново.
 * Поэтому главы нумеруются СКВОЗНО по книгам издания в их порядке: Даниил
 * 1–12, Сусанна становится тринадцатой, Вил четырнадцатой. Тем и хорошо, что
 * совпадает с каноническим счётом ровно там, где славянская Библия свела эти
 * книги в одну.
 */
export const baseChapters = async (
    db: Db,
    editionId: ObjectId,
    canonId: string,
): Promise<Array<{ bookId: ObjectId; chapter: number }>> => {
    const books = await booksForCanon(db, editionId, canonId);
    const out: Array<{ bookId: ObjectId; chapter: number }> = [];

    for (const book of books) {
        const chapters = await db.collection(BIBLE_VERSES).distinct("chapter", { bookId: book._id });
        (chapters as number[]).sort((a, b) => a - b)
            .forEach((chapter) => out.push({ bookId: book._id, chapter }));
    }

    return out;
};

/**
 * Глава в счёте БАЗОВОГО издания: строки ведёт оно, остальные подтягиваются.
 *
 * Канонический вид отвечает на вопрос «что стоит напротив славянского стиха».
 * Этот — на обратный: «что напечатано в греческой двадцать четвёртой главе и
 * где эти стихи у славян». Оба нужны, и ни один не выводится из другого:
 * греческая 24-я задевает славянские 24, 30 и 31, а славянская 24-я собрана из
 * двух разных мест греческой.
 *
 * Работает это без единого нового правила: у стиха уже лежат обе нумерации, и
 * достаточно спросить по родной, а соседей подтянуть по canonRef. Соответствие
 * взаимно однозначно — на каждом издании проверено, что двух стихов на одном
 * каноническом месте нет, — поэтому обращение определено само собой.
 *
 * `index` — порядковый номер главы в списке baseChapters, начиная с единицы.
 */
export const chapterByBase = async (
    db: Db,
    base: BibleEdition,
    others: BibleEdition[],
    canonId: string,
    index: number,
): Promise<{ chapter: number; rows: ParallelRow[] } | null> => {
    const chapters = await baseChapters(db, base._id, canonId);
    const target = chapters[index - 1];
    if (!target) return null;

    const baseVerses = await db.collection(BIBLE_VERSES)
        .find({ bookId: target.bookId, chapter: target.chapter })
        .sort({ verse: 1 })
        .toArray();
    if (!baseVerses.length) return null;

    const refs = baseVerses.map((verse) => verse.canonRef as string);
    const otherIds = others.map((edition) => edition._id);
    const found = otherIds.length
        ? await db.collection(BIBLE_VERSES)
            .find({ editionId: { $in: otherIds }, canonRef: { $in: refs } })
            .toArray()
        : [];

    // Ключ — издание И каноническое место: одно издание может держать на одном
    // месте только один стих (это проверено), но изданий несколько.
    const byKey = new Map<string, ResolvedVerse>();
    found.forEach((doc) => {
        const key = `${doc.editionId.toString()}|${doc.canonRef}`;
        if (!byKey.has(key)) byKey.set(key, toResolved(doc));
    });

    return {
        chapter: target.chapter,
        rows: baseVerses.map((verse) => ({
            canonRef: verse.canonRef as string,
            // Номер строки — РОДНОЙ номер базового издания: здесь ведёт оно.
            number: verse.verse as number,
            cells: [
                toResolved(verse),
                ...otherIds.map((id) => byKey.get(`${id.toString()}|${verse.canonRef}`) ?? null),
            ],
        })),
    };
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
