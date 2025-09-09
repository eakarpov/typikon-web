import {NextApiRequest, NextApiResponse} from "next";
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method === 'POST') {
        const data = req.body;
        const id = req.query.id as string;
        const dataWithIds = data.map((d: any) => {
            if (d.id) {
                return {...d, textId: new ObjectId(id), _id: new ObjectId(d.id)};
            } else {
                return {...d, textId: new ObjectId(id)};
            }
        });
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            await db.collection("notes").deleteMany({
                textId: id,
            });

            const resp = await db
                .collection("notes")
                .insertMany(dataWithIds);
            res.status(200).end();
        } catch (e) {
            console.log("mongodb error");
            res.status(400).end();
        }
    } else {
        res.status(404).end();
    }
}