import { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { checkRightsBack } from "@/lib/admin/back";

// Решение по одной связи «акафист — святой».
//
// Вместе со статусом принимаем dneslovId: в ревью можно не только согласиться
// с предложенным, но и выбрать другого из альтернатив, и тогда сохранять надо
// выбранного, а не того, кого предложил сопоставитель.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) { res.status(404).end(); return; }
    if (req.method !== "POST") { res.status(405).end(); return; }
    if (!(await checkRightsBack(req, res))) return;

    const { id } = req.query;
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const status = body?.status;

    if (status !== "approved" && status !== "rejected") {
        res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
        return;
    }

    try {
        const client = await clientPromise;
        const col = client.db("typikon").collection("akathist_saint_links");

        const update: Record<string, unknown> = { status, decidedAt: new Date() };
        // Подтверждая, записываем ИМЕННО ТО, что человек видел на экране:
        // если он выбрал альтернативу, предложение сопоставителя больше не
        // истина, и хранить его как истину нельзя.
        if (status === "approved" && body?.dneslovId) {
            update.dneslovId = String(body.dneslovId);
            update.saintName = String(body.saintName ?? "");
        }

        const result = await col.updateOne({ _id: new ObjectId(String(id)) }, { $set: update });
        if (!result.matchedCount) { res.status(404).json({ error: "not found" }); return; }
        res.status(200).end();
    } catch (e) {
        console.error(e);
        res.status(400).json({ error: String(e) });
    }
}
