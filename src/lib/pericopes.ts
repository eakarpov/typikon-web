import { Db, ObjectId } from "mongodb";
import { filterVersesByRanges, sortVerses } from "@/utils/verses";
import { FALLBACK_BIBLE_LANGUAGE } from "@/utils/bibleLanguage";

// Резолвит зачало в реальные стихи для конкретного языка: находит издание Библии
// с нужным bibleLanguageCode, внутри него — книгу с нужным bibleBookSlug, и
// фильтрует её стихи по диапазонам зачала. Возвращает null, если для этого языка
// ещё нет ни самого издания, ни конкретной книги (например, книга ещё не размечена
// bibleBookSlug в админке).
export const resolvePericopeVerses = async (db: Db, pericope: any, lang: string) => {
    const book = await db.collection("books").findOne({ bibleLanguageCode: lang });
    if (!book) return null;

    const text = await db.collection("texts").findOne({ bookId: book._id, bibleBookSlug: pericope.bookSlug });
    if (!text) return null;

    const rawVerses = await db.collection("verses").find({ textId: text._id }).toArray();
    const sorted = sortVerses(rawVerses.map(v => ({ ...(v as any), id: v._id.toString() })));

    return {
        textId: text._id.toString(),
        textName: text.name,
        textAlias: text.alias,
        verses: filterVersesByRanges(sorted, pericope.ranges || []),
    };
};

// То же самое, но с фолбеком: если для запрошенного языка ещё нет размеченной
// книги/издания, тихо откатывается на церковнославянский, чтобы чтение не
// пропадало из-за того, что какая-то книга ещё не размечена для другого языка.
export const resolvePericopeVersesWithFallback = async (db: Db, pericope: any, lang: string) => {
    const resolved = await resolvePericopeVerses(db, pericope, lang);
    if (resolved) return { ...resolved, resolvedLang: lang };

    if (lang === FALLBACK_BIBLE_LANGUAGE) return null;

    const fallback = await resolvePericopeVerses(db, pericope, FALLBACK_BIBLE_LANGUAGE);
    return fallback ? { ...fallback, resolvedLang: FALLBACK_BIBLE_LANGUAGE } : null;
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
