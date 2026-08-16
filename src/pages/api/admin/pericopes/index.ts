import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {checkRightsBack} from "@/lib/admin/back";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (!(await checkRightsBack(req, res))) return;
    if (req.method === 'GET') {
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            const pericopes = await db
                .collection("pericopes")
                .find({})
                .sort({ name: 1 })
                .toArray();
            res.status(200).json(pericopes.map(p => ({ ...p, id: p._id.toString() })));
        } catch (e) {
            console.log("mongodb error");
            res.status(400).end();
        }
    } else if (req.method === 'POST') {
        const data = req.body;
        if (!data.name || !data.textId || !Array.isArray(data.ranges) || data.ranges.length === 0) {
            res.status(400).json({ error: "Нужны name, textId и хотя бы один диапазон в ranges" });
            return;
        }
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            await db.collection("pericopes").insertOne({
                name: data.name,
                textId: new ObjectId(data.textId),
                ranges: data.ranges.map((r: any) => ({
                    chapterFrom: parseInt(r.chapterFrom, 10),
                    verseFrom: parseInt(r.verseFrom, 10),
                    chapterTo: parseInt(r.chapterTo, 10),
                    verseTo: parseInt(r.verseTo, 10),
                })),
                updatedAt: new Date(),
            });
            res.status(200).end();
        } catch (e) {
            console.log("mongodb error");
            res.status(400).end();
        }
    } else {
        res.status(404).end();
    }
}
