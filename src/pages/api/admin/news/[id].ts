import { NextApiRequest, NextApiResponse } from "next";
import { checkRightsBack } from "@/lib/admin/back";
import { deletePost, listAll, updatePost } from "@/lib/news/posts";
import type { NewsStatus, NewsType } from "@/types/dto/news";

// Правка и удаление новости.
//
// Поля перечислены поимённо: тело приходит из браузера, и передавать его в $set
// целиком значило бы разрешить дописать в запись что угодно.

const TYPES: NewsType[] = ["update", "announcement"];
const STATUSES: NewsStatus[] = ["draft", "published"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (!(await checkRightsBack(req, res))) return;

    const id = req.query.id as string;

    if (req.method === "DELETE") {
        // Удаляем совсем, а не помечаем: выложенную новость правят, а удаляют обычно
        // черновик, о котором никто не знает и хранить который незачем.
        const deleted = await deletePost(id);

        if (!deleted) {
            res.status(404).json({ error: "Новость не найдена" });
            return;
        }

        res.status(200).json({ items: await listAll() });
        return;
    }

    if (req.method !== "POST") {
        res.status(404).end();
        return;
    }

    const { title, summary, body, type, version, status, alias } = req.body ?? {};

    if (title !== undefined && (typeof title !== "string" || !title.trim())) {
        res.status(400).json({ error: "Заголовок не может быть пустым" });
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
        const post = await updatePost(id, { title, summary, body, type, version, status, alias });

        if (!post) {
            res.status(404).json({ error: "Новость не найдена" });
            return;
        }

        res.status(200).json({ item: post, items: await listAll() });
    } catch (e) {
        console.error("admin news update", e);
        res.status(500).json({ error: "Не удалось сохранить новость" });
    }
}
