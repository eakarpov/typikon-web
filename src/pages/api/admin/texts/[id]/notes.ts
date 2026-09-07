import {NextApiRequest, NextApiResponse} from "next";
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {reportError} from "@/lib/reportError";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method === 'POST') {
        if (!(await checkRightsBack(req, res))) return;
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
            reportError(e, { where: "pages/api/admin/texts/[id]/notes#handler", source: "api" });
            res.status(400).end();
        }
    } else {
        res.status(404).end();
    }
}