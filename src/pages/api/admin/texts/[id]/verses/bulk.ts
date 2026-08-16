import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {parseBulkVerseText} from "@/utils/verses";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method !== 'POST') {
        res.status(404).end();
        return;
    }
    if (!(await checkRightsBack(req, res))) return;
    const id = req.query.id as string;
    const data = req.body;
    const rows = parseBulkVerseText(data.text || "");
    if (rows.length === 0) {
        res.status(400).json({ error: "Не удалось распознать ни одного стиха. Формат строки: глава:стих текст" });
        return;
    }
    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        const textId = new ObjectId(id);
        await db.collection("verses").deleteMany({ textId });
        await db.collection("verses").insertMany(
            rows.map(row => ({
                textId,
                chapter: row.chapter,
                verse: row.verse,
                content: row.content,
                updatedAt: new Date(),
            })),
        );
        res.status(200).json({ count: rows.length });
    } catch (e) {
        console.log("mongodb error");
        res.status(400).end();
    }
}
