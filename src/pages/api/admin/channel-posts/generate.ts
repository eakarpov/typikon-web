import type { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import { checkRightsBack } from "@/lib/admin/back";
import { channelPostsDb } from "@/lib/channelPosts/db";
import { generateChannelPosts, generationOptions } from "@/lib/channelPosts/generate";
import { reportError } from "@/lib/reportError";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) return res.status(404).end();
    if (req.method !== "POST" && req.method !== "GET") return res.status(405).end();
    if (!(await checkRightsBack(req, res))) return;
    res.setHeader("Cache-Control", "no-store");
    try {
        const runs = (await channelPostsDb()).collection("channelPostGenerationRuns");
        if (req.method === "GET") {
            if (typeof req.query.id !== "string" || !ObjectId.isValid(req.query.id)) return res.status(400).end();
            const run = await runs.findOne({ _id: new ObjectId(req.query.id) });
            if (!run) return res.status(404).json({ error: "Запуск не найден" });
            if (run.status === "running" && +run.expiresAt <= Date.now()) {
                return res.json({ status: "failed", error: "Генерация прервана или превысила время ожидания. Повторите запуск: готовые черновики сохраняются." });
            }
            return res.json({ status: run.status, result: run.result, error: run.error });
        }
        let options;
        try { options = generationOptions(req.body ?? {}); }
        catch (error) { return res.status(400).json({ error: (error as Error).message }); }
        const now = new Date();
        const { insertedId } = await runs.insertOne({
            status: "running", createdAt: now, expiresAt: new Date(+now + 30 * 60_000),
        });
        // Self-hosted Node process: finish work independently of HTTP/nginx
        // timeouts. Status survives page reloads; the shared generator locks cron too.
        void generateChannelPosts(options).then(
            result => runs.updateOne({ _id: insertedId }, { $set: { status: "completed", result, finishedAt: new Date() } }),
            error => {
                reportError(error, { where: "admin/channel-posts/generate", source: "api" });
                return runs.updateOne({ _id: insertedId }, { $set: {
                    status: "failed", finishedAt: new Date(),
                    error: "Генерация не завершена или уже выполняется. Уже созданные черновики сохранены; повторный запуск их пропустит.",
                } });
            },
        ).catch(error => reportError(error, { where: "admin/channel-posts/generate#status", source: "api" }));
        return res.status(202).json({ jobId: String(insertedId) });
    } catch (error) {
        reportError(error, { where: "admin/channel-posts/generate#handler", source: "api" });
        return res.status(500).json({ error: "Не удалось запустить генерацию или прочитать её результат" });
    }
}
