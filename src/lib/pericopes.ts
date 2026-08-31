import { Db, ObjectId } from "mongodb";
import { FALLBACK_BIBLE_LANGUAGE } from "@/utils/bibleLanguage";
import { expectedVerseCount } from "@/lib/bible/refs";
import { referenceChapterLengths } from "@/utils/bibleVersification";
import { booksForCanon, editionForLang, ResolvedVerse, versesForCanonRanges } from "@/lib/bible/query";
import { pericopeResolvesDirectly, pericopeVersification, versificationLabel } from "@/utils/versification";

// Зачало — это отрезок канона («Дан. 3:1–88»), а не отрезок конкретной книги
// конкретного издания. Поэтому резолвится оно так: издание выбирается по языку,
// а стихи берутся по КАНОНИЧЕСКОЙ нумерации — тогда неважно, что румынская Библия
// издала песнь трёх отроков отдельной книгой: в чтении она встанет посреди третьей
// главы Даниила, как ей и положено по уставу.
//
// Наружу отдаётся каноническая нумерация, а не родная нумерация издания: чтение
// подписано «Дан. 3:1–88», и стихи под этой подписью должны считаться так же.
// Родная остаётся рядом (nativeChapter/nativeVerse) — по ней стих ищут в книге.

/** Ниже этой доли ожидаемого чтение считается не покрытым и берётся из эталона. */
const COVERAGE_FLOOR = 0.5;

const toPericopeVerse = (verse: ResolvedVerse) => ({
    id: verse.id,
    chapter: verse.canonChapter,
    verse: verse.canonVerse,
    content: verse.content,
    // Как этот же стих напечатан в самом издании.
    nativeChapter: verse.chapter,
    nativeVerse: verse.verse,
});

/**
 * Резолвит зачало в стихи одного языка. Возвращает null, если издания для языка
 * нет, книга в нём отсутствует или отрезок покрыт слишком скудно, чтобы это можно
 * было назвать чтением, — решение о запасном языке принимает вызывающий.
 */
export const resolvePericopeVerses = async (db: Db, pericope: any, lang: string) => {
    // В КАКОМ СЧЁТЕ ЗАПИСАНО ЗАЧАЛО. Наши 1067 — из Типикона Русской Церкви, и
    // «Дан. 3:1–88» у них значит номера Елизаветинской Библии, то есть эталон;
    // потому и резолвятся они прямо по canonRef. Зачало другого устава может
    // прийти в своём счёте, и тогда его сперва надо привести к эталону — правил
    // для этого нет. Отказываемся вслух: молча резолвить чужой счёт как свой
    // значит выдать читателю не тот отрывок, ничем этого не показав.
    if (!pericopeResolvesDirectly(pericope)) {
        console.warn(
            `зачало «${pericope.label ?? pericope._id}» записано в счёте ` +
            `«${versificationLabel(pericopeVersification(pericope))}», а не в эталонном — ` +
            "правил приведения для него нет, чтение не собрано",
        );
        return null;
    }

    const edition = await editionForLang(db, lang);
    if (!edition) return null;

    const canonId: string = pericope.bookSlug;
    const ranges = pericope.ranges || [];

    const verses = await versesForCanonRanges(db, edition._id, canonId, ranges);
    if (!verses.length) return null;

    // Покрытие меряем против эталонной версификации: издание может знать книгу, но
    // не знать половины отрезка — так румынский Даниил отдавал 33 стиха вместо 88,
    // и чтение обрывалось молча. Порог, а не строгое равенство, потому что издания
    // разбивают текст на стихи по-своему: у румынской Псалтири в девятом псалме
    // на стих меньше, и это не повод отнимать у читателя румынский текст.
    const expected = expectedVerseCount(ranges, referenceChapterLengths(canonId));
    if (expected && verses.length < expected * COVERAGE_FLOOR) return null;

    // Книга издания — та, где чтение НАЧИНАЕТСЯ: одну книгу канона издание может
    // собирать из нескольких своих (румынский Даниил собран из четырёх).
    const books = await booksForCanon(db, edition._id, canonId);
    const startBook = books.find((book) => book._id.equals(verses[0].bookId)) ?? books[0] ?? null;

    return {
        textId: startBook?._id.toString() ?? null,
        textName: startBook?.name ?? "",
        textAlias: startBook?.alias ?? "",
        editionCode: edition.code,
        verses: verses.map(toPericopeVerse),
    };
};

/**
 * То же, но с запасным языком: не собралось чтение на выбранном — отдаём
 * церковнославянское и честно говорим об этом в resolvedLang.
 *
 * Откатывается ЧТЕНИЕ ЦЕЛИКОМ, а не недостающая часть: сшитый из двух изданий
 * отрывок выглядел бы цельным, не будучи им, и разнобой заметил бы только тот,
 * кто читает на обоих языках сразу.
 */
export const resolvePericopeVersesWithFallback = async (db: Db, pericope: any, lang: string) => {
    const resolved = await resolvePericopeVerses(db, pericope, lang);
    if (resolved) return { ...resolved, requestedLang: lang, resolvedLang: lang };

    if (lang === FALLBACK_BIBLE_LANGUAGE) return null;

    const fallback = await resolvePericopeVerses(db, pericope, FALLBACK_BIBLE_LANGUAGE);
    // Отдаём и то, ЧЕГО ПРОСИЛИ: одного resolvedLang мало, чтобы показ понял,
    // была ли подмена. Сравнивать его на странице не с чем — выбранный язык
    // лежит в cookie и до карточки чтения не доходит.
    return fallback
        ? { ...fallback, requestedLang: lang, resolvedLang: FALLBACK_BIBLE_LANGUAGE }
        : null;
};

// Резолвит зачала внутри одного слота чтений дня ({ items: [...] }) — для каждого
// item с pericopeId подтягивает сам документ зачала и стихи под нужный язык,
// прикладывая результат как item.pericope. Остальные items (обычные textId)
// не трогает.
export const resolveItemsPericopes = async (db: Db, withItems: any, lang: string) => {
    if (!withItems?.items?.length) return withItems;

    const items = await Promise.all(withItems.items.map(async (item: any) => {
        if (!item.pericopeId) return item;

        const pericopeId = item.pericopeId instanceof ObjectId ? item.pericopeId : new ObjectId(item.pericopeId);
        const pericope = await db.collection("pericopes").findOne({ _id: pericopeId });
        if (!pericope) return item;

        const resolved = await resolvePericopeVersesWithFallback(db, pericope, lang);
        return {
            ...item,
            pericope: {
                id: pericope._id.toString(),
                source: pericope.source,
                bookSlug: pericope.bookSlug,
                label: pericope.label,
                ranges: pericope.ranges,
                ...resolved,
            },
        };
    }));

    return { ...withItems, items };
};

// Резолвит зачала сразу по всем слотам чтений дня (day/week/triodion-документ,
// уже прошедший обычную $lookup-агрегацию по TextType-полям).
export const resolveDayPericopes = async (db: Db, day: any, lang: string) => {
    if (!day) return day;

    const fieldNames = [
        "vespersProkimenon", "vigil", "kathisma1", "kathisma2", "kathisma3",
        "ipakoi", "polyeleos", "song3", "song6", "before1h", "panagia",
        "h1", "h3", "h6", "h9", "apolutikaTroparia", "before50",
        "apostleLiturgy", "gospelLiturgy", "gospelMatins",
    ];

    const resolvedEntries = await Promise.all(
        fieldNames
            .filter(field => day[field])
            .map(async field => [field, await resolveItemsPericopes(db, day[field], lang)] as const)
    );

    return { ...day, ...Object.fromEntries(resolvedEntries) };
};
