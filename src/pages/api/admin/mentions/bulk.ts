import { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { checkRightsBack } from "@/lib/admin/back";

const ALLOWED = ["pending", "approved", "rejected"];

// Меняет статус кандидатов на упоминание: либо перечисленных по id, либо всей пачки
// одного святого сразу — ошибки сопоставления обычно идут целой группой.
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

    const { ids, dneslovId, status } = req.body ?? {};

    if (!ALLOWED.includes(status)) {
        res.status(400).json({ error: "Неизвестный статус" });
        return;
    }
    if (!dneslovId && !(Array.isArray(ids) && ids.length)) {
        res.status(400).json({ error: "Нужен ids или dneslovId" });
        return;
    }

    try {
        const client = await clientPromise;
        const db = client.db("typikon");

        // Уже проставленные не трогаем: связь в mentionIds живёт своей жизнью,
        // и молча переворачивать её сменой статуса кандидата нельзя.
        const filter = dneslovId
            ? { dneslovId: String(dneslovId), status: { $ne: "applied" } }
            : { _id: { $in: (ids as string[]).map((id) => new ObjectId(id)) }, status: { $ne: "applied" } };

        const result = await db
            .collection("mentionCandidates")
            .updateMany(filter, { $set: { status, updatedAt: new Date() } });

        res.status(200).json({ updated: result.modifiedCount });
    } catch (e) {
        console.error(e);
        res.status(500).end();
    }
}
