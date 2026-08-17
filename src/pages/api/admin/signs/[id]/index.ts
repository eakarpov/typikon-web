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
        if (!(await checkRightsBack(req, res))) return;
        const data = req.body;
        const id = req.query.id as string;
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            await db
                .collection("signs")
                .updateOne(
                    { "_id" : new ObjectId(id) },
                    {
                        $set: {
                            name: data.name,
                            date: data.date,
                            month: data.month,
                            sign: data.sign,
                            source: data.source,
                            isDefault: !!data.isDefault,
                            signConditional: !!data.signConditional,
                            order: data.order,
                            needsReview: !!data.needsReview,
                            sourceUrl: data.sourceUrl,
                            updatedAt: new Date(),
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