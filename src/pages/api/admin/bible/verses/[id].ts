import { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { checkRightsBack } from "@/lib/admin/back";
import { BIBLE_VERSES } from "@/lib/bible/schema";

// Правка одного стиха — только содержимое.
//
// Номер стиха отсюда не меняется намеренно: он завязан на canonRef и canonSort,
// а те считаются правилами приведения при переносе книги целиком. Поправить номер
// в одном документе значило бы развести показ с поиском — стих остался бы найден
// по старому месту и показан на новом. Сбилась нумерация — перезаливается книга.
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

    const id = req.query.id as string;
    if (!id || !ObjectId.isValid(id)) {
        res.status(400).json({ error: "Не указан стих" });
        return;
    }

    if (typeof req.body?.content !== "string") {
        res.status(400).json({ error: "Нечего сохранять" });
        return;
    }

    try {
        const db = (await clientPromise).db("typikon");
        const result = await db.collection(BIBLE_VERSES).updateOne(
            { _id: new ObjectId(id) },
            { $set: { content: req.body.content, updatedAt: new Date() } },
        );

        if (!result.matchedCount) {
            res.status(404).json({ error: "Стих не найден" });
            return;
        }

        res.status(200).json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(400).end();
    }
}
