import { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from "@/lib/mongodb";
import { checkRightsBack } from "@/lib/admin/back";

// Переносит подтверждённые кандидаты в texts — то, что показывает /saints/[id]
// ("упоминается в чтениях", getMentions) и блок связей на странице чтения.
// Отклонённые и неразобранные не трогаются, поэтому кнопку можно жать сколько угодно раз.
//
// Пишем в два поля сразу:
//   * mentionIds — плоский список id, на нём висят индекс, публичный API v2
//     и мобильное приложение; трогать его форму нельзя;
//   * mentions — тот же список с найденным словом и фрагментом вокруг него.
//     Ровно ради этого фрагмента ревью и затевалось: список одних заголовков
//     читателю ничего не говорит, а строка "…наполньшися елисаветь разуме…" —
//     говорит. Раньше word/context доезжали до кандидата и там же пропадали.
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

    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        const collection = db.collection("mentionCandidates");

        const approved = await collection.find({ status: "approved" }).toArray();

        if (!approved.length) {
            res.status(200).json({ links: 0, texts: 0 });
            return;
        }

        const byText = new Map<string, { textId: any; mentions: Map<string, any> }>();
        for (const c of approved) {
            const key = c.textId.toString();
            const entry = byText.get(key) ?? { textId: c.textId, mentions: new Map<string, any>() };
            entry.mentions.set(c.dneslovId, {
                dneslovId: c.dneslovId,
                word: c.word ?? null,
                context: c.context ?? null,
            });
            byText.set(key, entry);
        }

        let links = 0;
        for (const [, entry] of byText) {
            const ids = [...entry.mentions.keys()];

            // Сначала убираем прежние записи по этим же святым: пара текст/святой
            // должна остаться одна, даже если кандидата вернули в работу и одобрили заново.
            await db.collection("texts").updateOne(
                { _id: entry.textId },
                { $pull: { mentions: { dneslovId: { $in: ids } } } } as any,
            );
            await db.collection("texts").updateOne(
                { _id: entry.textId },
                {
                    $addToSet: { mentionIds: { $each: ids } },
                    $push: { mentions: { $each: [...entry.mentions.values()] } },
                } as any,
            );
            links += ids.length;
        }

        await collection.updateMany(
            { status: "approved" },
            { $set: { status: "applied", appliedAt: new Date() } },
        );

        res.status(200).json({ links, texts: byText.size });
    } catch (e) {
        console.error(e);
        res.status(500).end();
    }
}
