import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";
import {verifySession, verifySessionBack} from "@/lib/authorize/authorization";
import * as process from "node:process";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method === 'POST') {
        if (process.env.NODE_ENV !== "development") {
            const hasSession = await verifySessionBack(req, true);
            console.log(hasSession);
            if (!hasSession) {
                res.status(404).end();
            }
        }
        const data = req.body;
        const id = req.query.id as string;
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            await db
                .collection("places")
                .updateOne(
                    { "_id" : new ObjectId(id) },
                    {
                        $set: {
                            alias: data.alias,
                            updatedAt: new Date(),
                            name: data.name,
                            synonyms: data.synonyms,
                            description: data.description,
                            links: data.links,
                            latitude: data.latitude,
                            longitude: data.longitude,
                        },
                    },
                );

            res.status(200).end();
        } catch (e) {
            console.log("mongodb error");
        }
    } else {
        res.status(404).end();
    }
}