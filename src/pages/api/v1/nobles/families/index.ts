import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {init} from "@/lib/sqlite";
import {reportError} from "@/lib/reportError";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        try {
            const search = req.query.query || "";
            const db = await init();

            let data = [];

            if (search) {
                data = await db.prepare(`
                SELECT *
                FROM families
                WHERE ROWID IN (SELECT ROWID FROM families_text WHERE name LIKE ? ORDER BY rank)`)
                    .all(`%${search}%`);
            } else {
                data = await db.prepare(`
                SELECT *
                FROM families limit 10`)
                    .all();
            }

            res.json({
                data,
            });
        } catch (e) {
            reportError(e, { where: "pages/api/v1/nobles/families/index#handler", source: "api" });
            res.status(400).end();
        }
    } else {
        res.status(405).end();
    }
}