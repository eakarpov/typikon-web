import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {ObjectId} from "mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method === 'POST') {
        const {weekId} = req.body;
        if (!weekId) {
            res.status(400).end();
        }
        try {
            const client = await clientPromise;
            const db = client.db("typikon");
            res.status(200).end();
        } catch (e) {
            console.log("mongodb error");
        }
    } else {
        res.status(404).end();
    }
}