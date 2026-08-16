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
    const verseId = req.query.verseId as string;
    if (req.method === 'POST') {
        const data = req.body;
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            await db.collection("verses").updateOne(
                { _id: new ObjectId(verseId) },
                {
                    $set: {
                        chapter: parseInt(data.chapter, 10),
                        verse: parseInt(data.verse, 10),
                        content: data.content || "",
                        updatedAt: new Date(),
                    },
                },
            );
            res.status(200).end();
        } catch (e) {
            console.log("mongodb error");
            res.status(400).end();
        }
    } else if (req.method === 'DELETE') {
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            await db.collection("verses").deleteOne({ _id: new ObjectId(verseId) });
            res.status(200).end();
        } catch (e) {
            console.log("mongodb error");
            res.status(400).end();
        }
    } else {
        res.status(404).end();
    }
}
