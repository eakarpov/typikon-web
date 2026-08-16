import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import { checkRightsBack } from "@/lib/admin/back";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (!(await checkRightsBack(req, res))) return;

    const client = await clientPromise;
    const db = client.db("typikon");

    if (req.method === 'GET') {
        const { source, bookSlug } = req.query;
        const match: any = {};
        if (source) match.source = source;
        if (bookSlug) match.bookSlug = bookSlug;
        try {
            const pericopes = await db
                .collection("pericopes")
                .find(match)
                .sort({ source: 1, bookSlug: 1, number: 1, variant: 1 })
                .toArray();
            res.status(200).json(pericopes.map(p => ({ ...p, id: p._id.toString() })));
        } catch (e) {
            console.log("mongodb error");
            res.status(400).end();
        }
    } else if (req.method === 'POST') {
        const data = req.body;
        if (!data.source || !data.bookSlug || !data.number || !Array.isArray(data.ranges) || data.ranges.length === 0) {
            res.status(400).json({ error: "Нужны source, bookSlug, number и хотя бы один диапазон в ranges" });
            return;
        }
        try {
            await db.collection("pericopes").insertOne({
                source: data.source,
                bookSlug: data.bookSlug,
                number: parseInt(data.number, 10),
                variant: data.variant || null,
                label: data.label || "",
                occasions: Array.isArray(data.occasions) ? data.occasions : [],
                ranges: data.ranges.map((r: any) => ({
                    chapterFrom: parseInt(r.chapterFrom, 10),
                    verseFrom: parseInt(r.verseFrom, 10),
                    chapterTo: parseInt(r.chapterTo, 10),
                    verseTo: parseInt(r.verseTo, 10),
                })),
                updatedAt: new Date(),
            });
            res.status(200).end();
        } catch (e) {
            console.log("mongodb error");
            res.status(400).end();
        }
    } else {
        res.status(404).end();
    }
}
