import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method === 'POST') {
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
            console.log("mongodb error");
        }
    } else {
        res.status(404).end();
    }
}