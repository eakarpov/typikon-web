import {NextApiRequest, NextApiResponse} from "next";
import clientPromise from "@/lib/mongodb";
import {resolvePericopeVerses} from "@/lib/pericopes";

// Поиск зачал по человекочитаемым признакам, а не по ObjectId:
//   GET /api/v1/pericopes?source=gospel&bookSlug=matfeya&number=51&variant=а&lang=cs
// Если lang задан и найдено ровно одно совпадение — сразу резолвит стихи.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.status(404).end();
        return;
    }
    const { source, bookSlug, number, variant, lang } = req.query;

    const match: any = {};
    if (source) match.source = source;
    if (bookSlug) match.bookSlug = bookSlug;
    if (number) match.number = parseInt(number as string, 10);
    if (variant) match.variant = variant;

    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        const pericopes = await db
            .collection("pericopes")
            .find(match)
            .sort({ source: 1, bookSlug: 1, number: 1, variant: 1 })
            .toArray();

        const base = pericopes.map(p => ({
            id: p._id.toString(),
            source: p.source,
            bookSlug: p.bookSlug,
            number: p.number,
            variant: p.variant,
            label: p.label,
            occasions: p.occasions,
            ranges: p.ranges,
        }));

        if (lang && pericopes.length === 1) {
            const resolved = await resolvePericopeVerses(db, pericopes[0], lang as string);
            res.status(200).json(resolved ? [{ ...base[0], lang, ...resolved }] : base);
            return;
        }

        res.status(200).json(base);
    } catch (e) {
        console.error(e);
        res.status(400).end();
    }
}
