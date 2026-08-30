import { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { checkRightsBack } from "@/lib/admin/back";
import { parseBulkVerseText } from "@/utils/verses";
import { canonSort, formatCanonRef } from "@/lib/bible/refs";
import { mappingsFor, toCanonRef } from "@/lib/bible/mappings";
import { BibleBook, BIBLE_BOOKS, BIBLE_EDITIONS, BIBLE_VERSES } from "@/lib/bible/schema";

// Стихи одной книги издания: показать и заменить целиком.
//
// Замена считает каноническую ссылку тут же, теми же правилами, что и перенос
// (@/lib/bible/mappings). Иначе заново набранная книга легла бы в базу без
// canonRef — то есть видимой в своём издании, но невидимой для зачал и параллели,
// и заметить это можно было бы только на службе.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }

    const id = req.query.id as string;
    if (!id || !ObjectId.isValid(id)) {
        res.status(400).json({ error: "Не указана книга" });
        return;
    }

    const bookId = new ObjectId(id);

    try {
        const db = (await clientPromise).db("typikon");

        if (req.method === "GET") {
            if (!(await checkRightsBack(req, res))) return;
            const verses = await db.collection(BIBLE_VERSES)
                .find({ bookId })
                .sort({ canonSort: 1 })
                .toArray();
            res.status(200).json(verses.map((v) => ({
                id: v._id.toString(),
                chapter: v.chapter,
                verse: v.verse,
                canonChapter: v.canonChapter,
                canonVerse: v.canonVerse,
                content: v.content,
            })));
            return;
        }

        if (req.method !== "POST") {
            res.status(404).end();
            return;
        }
        if (!(await checkRightsBack(req, res))) return;

        const rows = parseBulkVerseText(req.body?.text || "");
        if (!rows.length) {
            res.status(400).json({
                error: "Не удалось распознать ни одного стиха. Формат строки: глава:стих текст",
            });
            return;
        }

        const book = await db.collection(BIBLE_BOOKS).findOne({ _id: bookId }) as BibleBook | null;
        if (!book) {
            res.status(404).json({ error: "Книга не найдена" });
            return;
        }

        const edition = await db.collection(BIBLE_EDITIONS).findOne({ _id: book.editionId });
        if (!edition) {
            res.status(404).json({ error: "Издание книги не найдено" });
            return;
        }

        const mapping = mappingsFor(edition.code as string);
        const now = new Date();

        await db.collection(BIBLE_VERSES).deleteMany({ bookId });
        await db.collection(BIBLE_VERSES).insertMany(rows.map((row) => {
            const ref = toCanonRef(mapping, book.slug, row.chapter, row.verse);
            return {
                editionId: book.editionId,
                bookId,
                canonId: ref.canonId,
                chapter: row.chapter,
                verse: row.verse,
                canonChapter: ref.chapter,
                canonVerse: ref.verse,
                canonRef: formatCanonRef(ref.canonId, ref.chapter, ref.verse),
                canonSort: canonSort(ref.chapter, ref.verse),
                content: row.content,
                updatedAt: now,
            };
        }));

        res.status(200).json({ count: rows.length });
    } catch (e) {
        console.error(e);
        res.status(400).end();
    }
}
