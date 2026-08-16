import {NextApiRequest, NextApiResponse} from "next";
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {resolvePericopeVerses} from "@/lib/pericopes";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.status(404).end();
        return;
    }
    const id = req.query.id as string;
    const lang = req.query.lang as string | undefined;
    if (!id || !ObjectId.isValid(id)) {
        res.status(400).end();
        return;
    }
    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        const pericope = await db.collection("pericopes").findOne({ _id: new ObjectId(id) });
        if (!pericope) {
            res.status(404).end();
            return;
        }

        const base = {
            id: pericope._id.toString(),
            source: pericope.source,
            bookSlug: pericope.bookSlug,
            number: pericope.number,
            variant: pericope.variant,
            label: pericope.label,
            occasions: pericope.occasions,
            ranges: pericope.ranges,
        };

        if (!lang) {
            res.status(200).json(base);
            return;
        }

        const resolved = await resolvePericopeVerses(db, pericope, lang);
        if (!resolved) {
            res.status(200).json({ ...base, lang, verses: null, error: "Для этого языка ещё нет размеченной книги" });
            return;
        }

        res.status(200).json({ ...base, lang, ...resolved });
    } catch (e) {
        console.error(e);
        res.status(400).end();
    }
}
