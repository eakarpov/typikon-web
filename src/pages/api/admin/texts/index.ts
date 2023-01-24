import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method === 'POST') {
        const {bookId} = req.body;
        if (!bookId) {
            res.status(400).end();
        }
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            const data = await db
                .collection("texts")
                .insertOne({
                    name: "",
                    content: "",
                    description: "",
                    start: "",
                    fileId: null,
                    link: null,
                    ruLink: null,
                    bookId: new ObjectId(bookId),
                    footnotes: [],
                });
            await db.collection("books")
                .updateOne(
                    { _id : new ObjectId(bookId) },
                    {
                        $addToSet: {
                            texts: data.insertedId,
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