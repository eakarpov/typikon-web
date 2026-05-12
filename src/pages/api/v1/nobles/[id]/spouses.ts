import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {init} from "@/lib/sqlite";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        try {
            const id = req.query.id as string;
            const db = await init();

            const data = await db.prepare(`select * from nobles where id= ?`).get(id);

            const isMale = !!data.gender;

            const result = await db.prepare(`select * from couples where husbandId = ? or wifeId = ?`).all(
                id,
                id
            );

            const answer = result
                .filter((item) => isMale ? item.husbandId === parseInt(id) : item.wifeId === parseInt(id) );
            res.json({
                data: answer,
            });
        } catch (e) {
            console.log("mongodb error", e);
            res.status(400).end();
        }
    } else {
        res.status(405).end();
    }
}