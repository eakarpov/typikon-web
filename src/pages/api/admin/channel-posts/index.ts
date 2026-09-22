import { NextApiRequest, NextApiResponse } from 'next'
import { ObjectId } from "mongodb";
import { channelPostsDb } from "@/lib/channelPosts/db";
import { checkRightsBack } from "@/lib/admin/back";
import {reportError} from "@/lib/reportError";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
        res.status(405).end();
        return;
    }
    if (!(await checkRightsBack(req, res))) return;

    try {
        const db = await channelPostsDb();

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

        if (req.method === 'DELETE') {
            // Чистка архива пачкой. Удаляются ТОЛЬКО опубликованные, и это условие
            // стоит в запросе, а не проверяется до него: пачка приходит списком
            // идентификаторов, и ошибка в списке не должна уносить неотправленный
            // черновик, который правили полчаса.
            const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
            if (!ids?.length || !ids.every((id: unknown) => typeof id === "string" && ObjectId.isValid(id))) {
                res.status(400).end();
                return;
            }

            const result = await db.collection("channelPosts").deleteMany({
                _id: { $in: ids.map((id: string) => new ObjectId(id)) },
                status: "published",
            });
            res.status(200).json({ deleted: result.deletedCount });
            return;
        }

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const posts = await db
            .collection("channelPosts")
            // Опубликованное — в «Архиве» на странице, здесь его нет (app/admin/channel-posts/api).
            .find({ scheduledAt: { $gte: since }, status: { $ne: "published" } })
            .sort({ scheduledAt: 1 })
            .limit(50)
            .toArray();

        res.status(200).json(
            posts.map(({ _id, ...post }) => ({ ...post, id: _id.toString() })),
        );
    } catch (e) {
        reportError(e, { where: "pages/api/admin/channel-posts/index#handler", source: "api" });
        res.status(500).end();
    }
}
