import {NextApiRequest, NextApiResponse} from "next";
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {filterVersesByRanges, parseVerseRanges, sortVerses} from "@/utils/verses";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.status(404).end();
        return;
    }
    const id = req.query.id as string;
    const ranges = req.query.ranges as string | undefined;
    if (!id || !ObjectId.isValid(id)) {
        res.status(400).end();
        return;
    }
    try {
        const client = await clientPromise;
        const db = client.db("typikon");
        const textId = new ObjectId(id);
        const rawVerses = await db
            .collection("verses")
            .find({ textId })
            .toArray();
        const sorted = sortVerses(rawVerses.map(v => ({ ...(v as any), id: v._id.toString() })));
        const filtered = filterVersesByRanges(sorted, parseVerseRanges(ranges));
        res.status(200).json(filtered);
    } catch (e) {
        console.error(e);
        res.status(400).end();
    }
}
