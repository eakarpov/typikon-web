import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {init} from "@/lib/sqlite";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method === 'POST') {
        res.status(405).end();
    } else {
        try {
            const id = req.query.id as string;
            const db = await init();

            const data = await db.prepare(`select * from rules where id=?`).get(id);

            const person = await db.prepare(`select * from nobles where id=?`).get(data.personId);

            data.person = person;

            res.json({
                data,
            });
        } catch (e) {
            console.log("mongodb error", e);
            res.status(400).end();
        }
    }
}