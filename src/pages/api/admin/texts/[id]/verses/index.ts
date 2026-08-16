import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {sortVerses} from "@/utils/verses";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    const id = req.query.id as string;
    if (req.method === 'GET') {
        if (!(await checkRightsBack(req, res))) return;
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            const verses = await db
                .collection("verses")
                .find({ textId: new ObjectId(id) })
                .toArray();
            res.status(200).json(sortVerses(verses.map(v => ({ ...(v as any), id: v._id.toString() }))));
        } catch (e) {
            console.log("mongodb error");
            res.status(400).end();
        }
    } else if (req.method === 'POST') {
        if (!(await checkRightsBack(req, res))) return;
        const data = req.body;
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            const inserted = await db.collection("verses").insertOne({
                textId: new ObjectId(id),
                chapter: parseInt(data.chapter, 10),
                verse: parseInt(data.verse, 10),
                content: data.content || "",
                updatedAt: new Date(),
            });
            res.status(200).json({ id: inserted.insertedId.toString() });
        } catch (e) {
            console.log("mongodb error");
            res.status(400).end();
        }
    } else {
        res.status(404).end();
    }
}
