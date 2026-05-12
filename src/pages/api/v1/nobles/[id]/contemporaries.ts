import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {init} from "@/lib/sqlite";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        res.status(405).end();
    } else {
        try {
            const id = req.query.id as string;
            const db = await init();

            const data = await db.prepare(`select * from nobles where id= ?`).get(id);

            const result = await db.prepare(`select * from nobles where
                birthDateMarker > ? and birthDateMarker < ? or
                deathDateMarker > ? and deathDateMarker < ?
            `).all(
                data.birthDateMarker,
                data.deathDateMarker,
                data.birthDateMarker,
                data.deathDateMarker,
            );

            res.json({
                data: result.filter((el) => parseInt(el.rank) > 1),
            });
        } catch (e) {
            console.log("mongodb error", e);
            res.status(400).end();
        }
    }
}