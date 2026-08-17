import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {checkRightsBack} from "@/lib/admin/back";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method === 'POST') {
        if (!(await checkRightsBack(req, res))) return;
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            await db
                .collection("signs")
                .insertOne({
                    name: "",
                    date: 0,
                    month: 0,
                    sign: "NO_SIGN",
                    source: "typikon",
                    isDefault: false,
                    signConditional: false,
                    order: 0,
                    needsReview: false,
                    createdAt: new Date(),
                });

            res.status(200).end();
        } catch (e) {
            console.log("mongodb error");
        }
    } else {
        res.status(404).end();
    }
}