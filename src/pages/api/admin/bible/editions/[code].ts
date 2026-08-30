import { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "@/lib/mongodb";
import { checkRightsBack } from "@/lib/admin/back";
import { BIBLE_EDITIONS } from "@/lib/bible/schema";

// Правка описания издания. Состав книг и стихи здесь не трогаются: их правят
// отдельно, и смешивать «переименовать издание» с «переписать книгу» опасно.
//
// Правила приведения к канону (mapping) здесь не редактируются намеренно. Они
// живут в @/lib/bible/mappings, в гите, с объяснением и тестами на каждое — а
// применяются скриптом ко всем стихам разом (recompute-bible-canon). Правка через форму
// разошлась бы с тем, что уже посчитано в canonRef, и издание стало бы
// показывать одно, а искать по другому.
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

    const code = req.query.code as string;
    if (!code) {
        res.status(400).json({ error: "Не указан код издания" });
        return;
    }

    const data = req.body || {};

    try {
        const db = (await clientPromise).db("typikon");

        // Издание по умолчанию для языка — ровно одно: без снятия флага у соседа
        // выбор языка стал бы зависеть от порядка документов в базе.
        if (data.isDefaultForLang && data.langCode) {
            await db.collection(BIBLE_EDITIONS).updateMany(
                { langCode: data.langCode, code: { $ne: code } },
                { $set: { isDefaultForLang: false } },
            );
        }

        const result = await db.collection(BIBLE_EDITIONS).updateOne(
            { code },
            {
                $set: {
                    title: data.title ?? "",
                    shortTitle: data.shortTitle ?? "",
                    langCode: data.langCode ?? "",
                    language: data.language ?? "",
                    isDefaultForLang: Boolean(data.isDefaultForLang),
                    versification: data.versification ?? "",
                    year: Number.isFinite(Number(data.year)) && data.year !== "" ? Number(data.year) : null,
                    sourceLink: data.sourceLink ?? "",
                    order: Number(data.order) || 0,
                    public: data.public !== false,
                    updatedAt: new Date(),
                },
            },
        );

        if (!result.matchedCount) {
            res.status(404).json({ error: "Издание не найдено" });
            return;
        }

        res.status(200).json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(400).end();
    }
}
