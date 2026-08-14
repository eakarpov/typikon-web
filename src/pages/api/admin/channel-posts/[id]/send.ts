import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { checkRightsBack } from "@/lib/admin/back";
import { sendChannelPostToTelegram } from "@/lib/channelPosts/telegram";

// Отправка поста немедленно, минуя scheduledAt и статус ready — для теста отправки в Telegram
// и на случай, если по какой-то причине пропустили окно крона (например пост на 18:00 не ушёл,
// а сейчас уже позже) и ждать следующего слота нет смысла.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).end();
        return;
    }
    if (!(await checkRightsBack(req, res))) return;

    const id = req.query.id as string;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const channelId = process.env.TELEGRAM_CHANNEL_ID;

    if (!botToken || !channelId) {
        res.status(500).json({ error: "Не заданы TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID" });
        return;
    }

    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        const post = await db.collection("channelPosts").findOne({ _id: new ObjectId(id) });
        if (!post) {
            res.status(404).end();
            return;
        }

        await sendChannelPostToTelegram(post as any, botToken, channelId);

        await db.collection("channelPosts").updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: "published", publishedAt: new Date(), publishError: null } },
        );

        res.status(200).end();
    } catch (e) {
        console.error(e);
        await (await clientPromise).db("typikon").collection("channelPosts").updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: "failed", publishError: String((e as Error)?.message || e) } },
        );
        res.status(500).json({ error: String((e as Error)?.message || e) });
    }
}
