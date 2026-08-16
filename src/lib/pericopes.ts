import { Db } from "mongodb";
import { filterVersesByRanges, sortVerses } from "@/utils/verses";

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
