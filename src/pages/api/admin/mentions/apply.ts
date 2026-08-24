import { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from "@/lib/mongodb";
import { checkRightsBack } from "@/lib/admin/back";

// Переносит подтверждённые кандидаты в texts.mentionIds — то, что показывает
// /saints/[id] ("упоминается в чтениях", getMentions). Отклонённые и неразобранные
// не трогаются, поэтому кнопку можно жать сколько угодно раз.
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

        const byText = new Map<string, { textId: any; ids: Set<string> }>();
        for (const c of approved) {
            const key = c.textId.toString();
            const entry = byText.get(key) ?? { textId: c.textId, ids: new Set<string>() };
            entry.ids.add(c.dneslovId);
            byText.set(key, entry);
        }

        let links = 0;
        for (const [, entry] of byText) {
            await db.collection("texts").updateOne(
                { _id: entry.textId },
                { $addToSet: { mentionIds: { $each: [...entry.ids] } } },
            );
            links += entry.ids.size;
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
