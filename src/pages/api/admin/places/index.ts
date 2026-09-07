import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {reportError} from "@/lib/reportError";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method === 'POST') {
        if (!(await checkRightsBack(req, res))) return;
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            await db
                .collection("places")
                .insertOne({
                    name: "",
                    alias: "",
                    synonyms: [],
                    description: "",
                    links: [],
                    latitude: "",
                    longitude: "",
                    createdAt: new Date(),
                });

            res.status(200).end();
        } catch (e) {
            reportError(e, { where: "pages/api/admin/places/index#handler", source: "api" });
        }
    } else {
        res.status(404).end();
    }
}