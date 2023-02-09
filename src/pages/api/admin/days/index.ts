import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method === 'POST') {
        const {weekId, monthId} = req.body;
        if (!weekId && !monthId) {
            res.status(400).end();
        }
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            const data = await db
                .collection("days")
                .insertOne({
                    name: "",
                    vespersProkimenon: null,
                    vigil: null,
                    kathisma1: null,
                    kathisma2: null,
                    kathisma3: null,
                    ipakoi: null,
                    polyeleos: null,
                    song3: null,
                    song6: null,
                    apolutikaTroparia: null,
                    before1h: null,
                    h1: null,
                    h3: null,
                    h6: null,
                    h9: null,
                    panagia: null,
                    fileId: null,
                    subnames: [],
                    triodic: true,
                    weekId: weekId ? new ObjectId(weekId) : null,
                    monthId: monthId ? new ObjectId(monthId) : null,
                    weekIndex: 0,
                    createdAt: new Date(),
                });
            if (weekId) {
                await db.collection("weeks")
                    .updateOne(
                        { _id : new ObjectId(weekId) },
                        {
                            $addToSet: {
                                days: data.insertedId,
                                updatedAt: new Date(),
                            },
                        },
                    );
            }
            if (monthId) {
                await db.collection("months")
                    .updateOne(
                        { _id : new ObjectId(monthId) },
                        {
                            $addToSet: {
                                days: data.insertedId,
                                updatedAt: new Date(),
                            },
                        },
                    );
            }
            res.status(200).end();
        } catch (e) {
            console.log("mongodb error");
        }
    } else {
        res.status(404).end();
    }
}