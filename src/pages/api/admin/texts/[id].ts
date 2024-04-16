import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method === 'POST') {
        const data = req.body;
        const id = req.query.id as string;
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            await db
                .collection("texts")
                .updateOne(
                    { "_id" : new ObjectId(id) },
                    {
                        $set: {
                            name: data.name,
                            footnotes: data.footnotes,
                            start: data.start,
                            description: data.description,
                            type: data.type,
                            bookIndex: parseInt(data.bookIndex, 10),
                            readiness: data.readiness,
                            content: data.content,
                            updatedAt: new Date(),
                            ruLink: data.ruLink,
                            link: data.link,
                            translator: data.translator,
                            author: data.author,
                            alias: data.alias,
                            poems: data.poems,
                            images: data.images,
                            dneslovId: data.dneslovId,
                            dneslovType: data.dneslovType,
                        },
                    },
                );

            res.status(200).end();
        } catch (e) {
            console.log("mongodb error");
        }
    } else {
        res.status(404).end();
    }
}