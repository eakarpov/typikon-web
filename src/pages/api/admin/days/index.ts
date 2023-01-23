import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const {weekId} = req.body;
        if (!weekId) {
            res.status(400).end();
        }
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            const data = await db
                .collection("days")
                .insertOne({
                    name: "",
                    vigil: null,
                    kathisma1: null,
                    kathisma2: null,
                    kathisma3: null,
                    ipakoi: null,
                    song3: null,
                    song6: null,
                    before1h: null,
                    polyeleos: null,
                    panagia: null,
                    fileId: null,
                    subnames: [],
                    triodic: true,
                    weekId: new ObjectId(weekId),
                    weekIndex: 0,
                });
            await db.collection("weeks")
                .updateOne(
                    { _id : new ObjectId(weekId) },
                    {
                        $addToSet: {
                            days: data.insertedId,
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