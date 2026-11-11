import type {NextApiRequest, NextApiResponse} from "next";
import {ObjectId} from "mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {channelPostsDb} from "@/lib/channelPosts/db";
import {checkAndSaveChannelPost} from "@/lib/channelPosts/checkPost";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) return res.status(404).end();
    if (req.method !== "POST") return res.status(405).end();
    if (!(await checkRightsBack(req, res))) return;
    if (typeof req.query.id !== "string" || !ObjectId.isValid(req.query.id)) return res.status(400).end();
    try {
        const db = await channelPostsDb();
        const post = await db.collection("channelPosts").findOne({_id: new ObjectId(req.query.id)});
        if (!post) return res.status(404).end();
        const result = await checkAndSaveChannelPost(db, post as any);
        res.status(200).json(result);
    } catch (e) {
        res.status(500).json({error: e instanceof Error ? e.message : "Не удалось выполнить проверку"});
    }
}
