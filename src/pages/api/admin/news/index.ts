import { NextApiRequest, NextApiResponse } from "next";
import { checkRightsBack } from "@/lib/admin/back";
import { createPost, listAll } from "@/lib/news/posts";
import type { NewsStatus, NewsType } from "@/types/dto/news";

// Заведение новости. Правка и удаление — в [id].ts.

const TYPES: NewsType[] = ["update", "announcement"];
const STATUSES: NewsStatus[] = ["draft", "published"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method !== "POST") {
        res.status(404).end();
        return;
    }
    if (!(await checkRightsBack(req, res))) return;

    const { title, summary, body, type, version, status } = req.body ?? {};

    if (!title || typeof title !== "string" || !title.trim()) {
        res.status(400).json({ error: "Заголовок обязателен: из него получается адрес новости" });
        return;
    }
    if (type !== undefined && !TYPES.includes(type)) {
        res.status(400).json({ error: `Неизвестный вид записи: ${type}` });
        return;
    }
    if (status !== undefined && !STATUSES.includes(status)) {
        res.status(400).json({ error: `Неизвестное состояние: ${status}` });
        return;
    }

    try {
        const post = await createPost({ title, summary, body, type, version, status });

        res.status(200).json({ item: post, items: await listAll() });
    } catch (e) {
        console.error("admin news create", e);
        res.status(500).json({ error: "Не удалось создать новость" });
    }
}
