import type { Db, ObjectId } from "mongodb";
import { BIBLE_BOOKS, BIBLE_EDITIONS, BIBLE_VERSES } from "@/lib/bible/schema";

// Согласование нумераций: где один и тот же стих стоит в каждом издании.
//
// Зачем это отдельно от чтения главы. Издания расходятся не только переводом, но
// и СЧЁТОМ: у румынской Псалтири в девятом псалме на стих меньше, чем у
// славянской, песнь трёх отроков напечатана в румынском издании отдельной книгой,
// греческие Притчи идут в 29 главах против славянского 31. Пара «глава:стих» сама
// по себе не значит ничего, пока не сказано, чьим счётом она названа.
//
// Внутри проекта это решено давно: у каждого стиха есть родной адрес (как
// напечатано) и канонический (приведённый правилами к Елизаветинской Библии).
// Здесь та же таблица отдаётся наружу — единственное, что для этого нужно, это
// уметь ходить по ней в обе стороны.
//
// Для выборки по одному стиху — этот модуль; для работы со всей таблицей сразу
// её надо брать файлом из выгрузки (/data): 192 106 строк по запросу не носят.

/** Адрес стиха: книга, глава, стих. */
export interface VerseRef {
    book: string;
    chapter: number;
    verse: number;
}

/**
 * Разбор адреса вида `bytie.1.1`. Отдельной функцией — потому что это
 * единственное место, где адрес превращается в числа, и ошибиться здесь значит
 * молча ответить про другой стих.
 *
 * Слуг книги проверяется только на форму: существует ли такая книга, знает база,
 * а не разбор строки.
 */
export const parseRef = (raw: string): VerseRef | null => {
    const value = (raw || "").trim();
    if (!value) return null;

    const parts = value.split(".");
    if (parts.length !== 3) return null;

    const [book, chapterRaw, verseRaw] = parts;
    if (!/^[a-z0-9-]+$/.test(book)) return null;

    const chapter = Number(chapterRaw);
    const verse = Number(verseRaw);
    if (!Number.isInteger(chapter) || chapter < 1) return null;
    if (!Number.isInteger(verse) || verse < 1) return null;

    return { book, chapter, verse };
};

export const formatRef = (ref: VerseRef): string => `${ref.book}.${ref.chapter}.${ref.verse}`;

/** Где стих стоит в одном издании. Мест может быть несколько: издание могло разорвать стих надвое. */
export interface EditionPlace {
    edition: string;
    book: string;
    places: VerseRef[];
}

/**
 * Сводит строки таблицы в ответ по изданиям. Чистая функция: вся возня с базой
 * остаётся снаружи, а порядок изданий задаётся вызывающим — в ответе колонки
 * должны стоять так, как их назвали в запросе.
 */
export const groupByEdition = (
    rows: { edition: string; book: string; chapter: number; verse: number }[],
    order: string[],
): EditionPlace[] => {
    const byEdition = new Map<string, EditionPlace>();

    for (const row of rows) {
        const found = byEdition.get(row.edition);
        if (found) {
            found.places.push({ book: row.book, chapter: row.chapter, verse: row.verse });
            continue;
        }
        byEdition.set(row.edition, {
            edition: row.edition,
            book: row.book,
            places: [{ book: row.book, chapter: row.chapter, verse: row.verse }],
        });
    }

    // Внутри издания места идут по порядку счёта, а не по порядку записей в базе:
    // разорванный надвое стих читается «14, 15», а не как ляжет.
    for (const place of byEdition.values()) {
        place.places.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);
    }

    const known = order.filter((code) => byEdition.has(code));
    const rest = [...byEdition.keys()].filter((code) => !order.includes(code)).sort();
    return [...known, ...rest].map((code) => byEdition.get(code)!);
};

interface RawRow {
    editionId: ObjectId;
    bookId: ObjectId;
    chapter: number;
    verse: number;
    canonId: string;
    canonChapter: number;
    canonVerse: number;
    canonRef: string;
}

const namesOf = async (db: Db) => {
    const [editions, books] = await Promise.all([
        db.collection(BIBLE_EDITIONS).find({}, { projection: { code: 1, order: 1, public: 1 } }).toArray(),
        db.collection(BIBLE_BOOKS).find({}, { projection: { slug: 1 } }).toArray(),
    ]);

    return {
        editionCode: new Map(editions.map((e: any) => [String(e._id), e.code as string])),
        editionId: new Map(editions.map((e: any) => [e.code as string, e._id])),
        // Порядок изданий тот же, что в параллельном чтении: он задан в базе и
        // менять его от ручки к ручке значило бы путать читателя.
        order: editions
            .filter((e: any) => e.public !== false)
            .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
            .map((e: any) => e.code as string),
        bookSlug: new Map(books.map((b: any) => [String(b._id), b.slug as string])),
    };
};

export interface Concordance {
    /** Канонический адрес — тот, которым названы зачала. */
    canonRef: string;
    editions: EditionPlace[];
}

/**
 * Все места одного канонического стиха. `from` называет издание, в чьём СОБСТВЕННОМ
 * счёте дан адрес; без него адрес считается каноническим.
 *
 * Возвращает null, если такого стиха нет вовсе, — это не ошибка запроса, а честный
 * ответ: в славянском каноне есть адреса, которых нет ни в одном другом издании.
 */
export const concordanceFor = async (
    db: Db,
    ref: VerseRef,
    from?: string,
): Promise<Concordance | null> => {
    const names = await namesOf(db);

    let canonRef = formatRef(ref);

    if (from) {
        const editionId = names.editionId.get(from);
        if (!editionId) return null;

        // Книга ищется по слугу ВНУТРИ издания: слуг у книги свой в каждом
        // издании, и «daniila» румынского — не та же запись, что славянского.
        const book = await db.collection(BIBLE_BOOKS).findOne(
            { editionId, slug: ref.book },
            { projection: { _id: 1 } },
        );
        if (!book) return null;

        const own = await db.collection(BIBLE_VERSES).findOne(
            { editionId, bookId: book._id, chapter: ref.chapter, verse: ref.verse },
            { projection: { canonRef: 1 } },
        ) as { canonRef?: string } | null;
        if (!own?.canonRef) return null;

        canonRef = own.canonRef;
    }

    const rows = await db.collection(BIBLE_VERSES)
        .find({ canonRef }, {
            projection: {
                editionId: 1, bookId: 1, chapter: 1, verse: 1,
                canonId: 1, canonChapter: 1, canonVerse: 1, canonRef: 1,
            },
        })
        .toArray() as unknown as RawRow[];

    if (!rows.length) return null;

    return {
        canonRef,
        editions: groupByEdition(
            rows.map((row) => ({
                edition: names.editionCode.get(String(row.editionId)) ?? "?",
                book: names.bookSlug.get(String(row.bookId)) ?? "?",
                chapter: row.chapter,
                verse: row.verse,
            })),
            names.order,
        ),
    };
};

/** Числа для страницы: насколько издание расходится со счётом эталона. */
export interface VersificationRow {
    edition: string;
    title: string;
    shortTitle: string;
    year: number | null;
    versification: string;
    verses: number;
    /** Стихи, чей напечатанный адрес не совпал с каноническим. */
    shifted: number;
    /** Книги, изданные отдельно от той, частью которой их держит канон. */
    detachedBooks: number;
}

/**
 * Сводка расхождений по изданиям. Считается по всей таблице (192 106 строк),
 * поэтому наружу отдаётся только через суточный кэш страницы: числа меняются
 * тогда же, когда меняется корпус, то есть редко.
 *
 * Эталон (Елизаветинская) стоит в ней с нулём расхождений — не потому, что он
 * верен, а потому, что канонический адрес по нему и определён. Это надо говорить
 * прямо, иначе ноль читается как оценка качества издания.
 */
export const versificationRows = async (db: Db): Promise<VersificationRow[]> => {
    const [editions, byEdition, books] = await Promise.all([
        db.collection(BIBLE_EDITIONS).find({ public: { $ne: false } }).sort({ order: 1 }).toArray(),
        db.collection(BIBLE_VERSES).aggregate([
            {
                $group: {
                    _id: "$editionId",
                    verses: { $sum: 1 },
                    shifted: {
                        $sum: {
                            $cond: [
                                {
                                    $or: [
                                        { $ne: ["$chapter", "$canonChapter"] },
                                        { $ne: ["$verse", "$canonVerse"] },
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                },
            },
        ]).toArray(),
        db.collection(BIBLE_BOOKS).find({}, { projection: { editionId: 1, slug: 1, canonId: 1 } }).toArray(),
    ]);

    const stats = new Map(byEdition.map((row: any) => [String(row._id), row]));
    const detached = new Map<string, number>();
    for (const book of books as any[]) {
        if (book.slug === book.canonId) continue;
        const key = String(book.editionId);
        detached.set(key, (detached.get(key) ?? 0) + 1);
    }

    return (editions as any[]).map((edition) => {
        const row = stats.get(String(edition._id));
        return {
            edition: edition.code,
            title: edition.title,
            shortTitle: edition.shortTitle,
            year: edition.year ?? null,
            versification: edition.versification,
            verses: row?.verses ?? 0,
            shifted: row?.shifted ?? 0,
            detachedBooks: detached.get(String(edition._id)) ?? 0,
        };
    });
};
