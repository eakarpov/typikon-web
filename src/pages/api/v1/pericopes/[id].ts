import {NextApiRequest, NextApiResponse} from "next";
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {filterVersesByRanges, sortVerses} from "@/utils/verses";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.status(404).end();
        return;
    }
    const id = req.query.id as string;
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
        const rawVerses = await db
            .collection("verses")
            .find({ textId: pericope.textId })
            .toArray();
        const sorted = sortVerses(rawVerses.map(v => ({ ...(v as any), id: v._id.toString() })));
        const verses = filterVersesByRanges(sorted, pericope.ranges || []);
        res.status(200).json({
            id: pericope._id.toString(),
            name: pericope.name,
            textId: pericope.textId.toString(),
            ranges: pericope.ranges,
            verses,
        });
    } catch (e) {
        console.error(e);
        res.status(400).end();
    }
}
