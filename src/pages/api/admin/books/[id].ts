import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {checkRightsBack} from "@/lib/admin/back";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method === 'POST') {
        await checkRightsBack(req, res);
        const id = req.query.id as string;
        const data = req.body;
        if (!id) {
            res.status(400).end();
        }
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            await db
                .collection("books")
                .updateOne(
                    { _id : new ObjectId(id) },
                    {
                        $set: {
                            name: data.name,
                            description: data.description,
                            translator: data.translator,
                            updatedAt: new Date(),
                            order: data.order,
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