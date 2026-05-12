import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {init} from "@/lib/sqlite";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        try {
            const search = req.query.query || "";
            const db = await init();

            let data = [];

            if (search) {
                data = await db.prepare(`
                SELECT *
                FROM nobles
                WHERE ROWID IN (SELECT ROWID FROM nobles_text WHERE name LIKE '%${search}%' ORDER BY rank)`)
                    .all();
            } else {
                data = await db.prepare(`
                SELECT *
                FROM nobles limit 10`)
                    .all();
            }

            res.json({
                data,
            });
        } catch (e) {
            console.log("mongodb error", e);
            res.status(400).end();
        }
    } else {
        res.status(405).end();
    }
}