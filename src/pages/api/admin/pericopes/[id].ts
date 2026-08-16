import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { checkRightsBack } from "@/lib/admin/back";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (!(await checkRightsBack(req, res))) return;

    const id = req.query.id as string;
    const client = await clientPromise;
    const db = client.db("typikon");

    if (req.method === 'POST') {
        const data = req.body;
        try {
            await db.collection("pericopes").updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
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
                    },
                },
            );
            res.status(200).end();
        } catch (e) {
            console.log("mongodb error");
            res.status(400).end();
        }
    } else if (req.method === 'DELETE') {
        try {
            await db.collection("pericopes").deleteOne({ _id: new ObjectId(id) });
            res.status(200).end();
        } catch (e) {
            console.log("mongodb error");
            res.status(400).end();
        }
    } else {
        res.status(404).end();
    }
}
