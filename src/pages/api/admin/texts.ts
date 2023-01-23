import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const data = req.body;
        const id = data.id;
        delete data.id;
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            console.log(data, id);
            await db
                .collection("texts")
                .updateOne(
                    { "_id" : new ObjectId(id) },
                    { $set: data },
                );

            res.status(200).end();
        } catch (e) {
            console.log("mongodb error");
        }
    } else {
      res.status(404).end();
    }
}