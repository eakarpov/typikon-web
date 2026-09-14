import { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { checkRightsBack } from "@/lib/admin/back";
import { reportError } from "@/lib/reportError";
import { decideCandidate, type Decision } from "@/lib/places/nikiforReview";

const ALLOWED: Decision[] = ["approved", "rejected", "pending"];

// Решение по паре «место ↔ статья Никифора» (@/lib/places/nikiforReview): принять,
// отклонить, вернуть в разбор. Принятие сразу пишет связь и имя в место.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method !== "POST") {
        res.status(405).end();
        return;
    }
    if (!(await checkRightsBack(req, res))) return;

    const { id, status } = req.body ?? {};
    if (!ALLOWED.includes(status) || typeof id !== "string" || !ObjectId.isValid(id)) {
        res.status(400).json({ error: "Нужны id кандидата и статус approved, rejected или pending" });
        return;
    }
    try {
        const db = (await clientPromise).db("typikon");
        res.status(200).json(await decideCandidate(db, id, status));
    } catch (e: any) {
        reportError(e, { where: "pages/api/admin/places/nikifor#handler", source: "api" });
        res.status(500).json({ error: e?.message ?? "Не удалось записать решение" });
    }
}
