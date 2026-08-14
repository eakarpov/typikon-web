import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { checkRightsBack } from "@/lib/admin/back";

const EDITABLE_FIELDS = ["text", "imageUrl", "hashtags", "status", "targets"] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method !== 'POST' && req.method !== 'DELETE') {
        res.status(405).end();
        return;
    }
    if (!(await checkRightsBack(req, res))) return;

    const id = req.query.id as string;

    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        if (req.method === 'DELETE') {
            await db.collection("channelPosts").deleteOne({ _id: new ObjectId(id) });
            res.status(200).end();
            return;
        }

        const data = req.body;
        const update: Record<string, unknown> = { updatedAt: new Date() };
        for (const field of EDITABLE_FIELDS) {
            if (data[field] !== undefined) update[field] = data[field];
        }

        await db
            .collection("channelPosts")
            .updateOne({ _id: new ObjectId(id) }, { $set: update });
        res.status(200).end();
    } catch (e) {
        console.error(e);
        res.status(500).end();
    }
}
