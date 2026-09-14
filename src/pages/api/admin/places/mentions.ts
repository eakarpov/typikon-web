import { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { checkRightsBack } from "@/lib/admin/back";
import { reportError } from "@/lib/reportError";
import { PLACE_MENTIONS } from "@/lib/places/schema";

const ALLOWED = ["pending", "approved", "rejected"];

// Статус упоминаний места в текстах: перечисленных по id или всех неразобранных
// у одного места. Решение помечается reviewedAt — повторный прогон поиска его не
// перезапишет. Пометки редактора ({pl|…}, method: "markup") здесь не меняются:
// их снимают правкой самого текста.
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

    const { ids, placeId, status } = req.body ?? {};
    if (!ALLOWED.includes(status)) {
        res.status(400).json({ error: "Неизвестный статус" });
        return;
    }
    const validIds = Array.isArray(ids) ? ids.filter((id: string) => ObjectId.isValid(id)) : [];
    if (!(placeId && ObjectId.isValid(placeId)) && !validIds.length) {
        res.status(400).json({ error: "Нужен ids или placeId" });
        return;
    }

    try {
        const db = (await clientPromise).db("typikon");
        // Чтения и песнопения; стихи Писания здесь не разбираются — у них своя сверка.
        const corpus = { $in: ["text", "chant"] };
        const filter = placeId
            ? { placeId: new ObjectId(placeId), corpus, status: "pending", method: { $ne: "markup" } }
            : { _id: { $in: validIds.map((id: string) => new ObjectId(id)) }, corpus, method: { $ne: "markup" } };
        const result = await db.collection(PLACE_MENTIONS).updateMany(filter, {
            $set: { status, reviewedAt: status === "pending" ? undefined : new Date() },
            ...(status === "pending" ? { $unset: { reviewedAt: "" } } : {}),
        } as any);
        res.status(200).json({ updated: result.modifiedCount });
    } catch (e) {
        reportError(e, { where: "pages/api/admin/places/mentions#handler", source: "api" });
        res.status(500).end();
    }
}
