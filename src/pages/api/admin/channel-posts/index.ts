import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import { checkRightsBack } from "@/lib/admin/back";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method !== 'GET') {
        res.status(405).end();
        return;
    }
    if (!(await checkRightsBack(req, res))) return;

    try {
        const client = await clientPromise;
        const db = client.db("typikon");

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
