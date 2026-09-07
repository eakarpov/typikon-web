import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {init} from "@/lib/sqlite";
import type {CoupleRow, NobleRow} from "@/lib/nobles/types";
import {reportError} from "@/lib/reportError";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        try {
            const id = req.query.id as string;
            const db = await init();

            const data = await db.prepare(`select * from nobles where id= ?`).get(id) as NobleRow | undefined;

            if (!data) {
                res.status(400).end();
                return;
            }

            const isMale = !!data.gender;

            const result = await db.prepare(`select * from couples where husbandId = ? or wifeId = ?`).all(
                id,
                id
            ) as CoupleRow[];

            const answer = result
                .filter((item) => isMale ? item.husbandId === parseInt(id) : item.wifeId === parseInt(id) );
            res.json({
                data: answer,
            });
        } catch (e) {
            reportError(e, { where: "pages/api/v1/nobles/[id]/spouses#handler", source: "api" });
            res.status(400).end();
        }
    } else {
        res.status(405).end();
    }
}