import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {init} from "@/lib/sqlite";
import {reportError} from "@/lib/reportError";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        try {
            const id = req.query.id as string;
            const db = await init();

            const data = await db.prepare(`select * from nobles where id=?`).get(id);

            res.json({
                data,
            });
        } catch (e) {
            reportError(e, { where: "pages/api/v1/nobles/[id]/index#handler", source: "api" });
            res.status(400).end();
        }
    } else {
        res.status(405).end();
    }
}