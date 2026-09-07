import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {init} from "@/lib/sqlite";
import {reportError} from "@/lib/reportError";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        if (!(await checkRightsBack(req, res))) return;
        try {
            const db = await init();

            let data = await db.prepare(`
                SELECT *
                FROM nobles where name is null`)
                    .all();

            res.json({
                data,
            });
        } catch (e) {
            reportError(e, { where: "pages/api/admin/nobles/empty#handler", source: "api" });
            res.status(400).end();
        }
    } else {
        res.status(405).end();
    }
}