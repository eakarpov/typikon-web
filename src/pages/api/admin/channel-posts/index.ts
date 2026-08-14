import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import { checkRightsBack } from "@/lib/admin/back";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.status(405).end();
        return;
    }
    if (!(await checkRightsBack(req, res))) return;

    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        if (req.method === 'POST') {
            const data = req.body;
            const scheduledAt = new Date(data.scheduledAt);
            if (!data.text || Number.isNaN(+scheduledAt)) {
                res.status(400).end();
                return;
            }

            const doc = {
                dayAlias: data.dayAlias || "",
                date: scheduledAt,
                slot: data.slot === 'evening' ? 'evening' : 'morning',
                scheduledAt,
                sourceTextId: null,
                sourceTextName: null,
                text: data.text,
                imageUrl: data.imageUrl || null,
                hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
                nameSource: 'none' as const,
                status: 'draft' as const,
                targets: { telegram: true, vk: false },
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const inserted = await db.collection("channelPosts").insertOne(doc);
            res.status(200).json({ id: inserted.insertedId.toString() });
            return;
        }

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const posts = await db
            .collection("channelPosts")
            .find({ scheduledAt: { $gte: since } })
            .sort({ scheduledAt: 1 })
            .limit(50)
            .toArray();

        res.status(200).json(
            posts.map(({ _id, ...post }) => ({ ...post, id: _id.toString() })),
        );
    } catch (e) {
        console.error(e);
        res.status(500).end();
    }
}
