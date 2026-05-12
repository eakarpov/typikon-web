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
        await checkRightsBack(req, res);
        try {
            const db = await init();

            db.exec(`insert into families DEFAULT VALUES`);

            res.status(200).end();
        } catch (e) {
            console.log("mongodb error", e);
            res.status(400).end();
        }
    } else {
        try {
            const search = req.query.query || "";
            const db = await init();

            const data = await db.prepare(`
                SELECT *
                FROM families
                WHERE ROWID IN (SELECT ROWID FROM families_text WHERE name LIKE '%${search}%' ORDER BY rank)`)
                .all();

            res.json({
                data,
            });
        } catch (e) {
            console.log("mongodb error", e);
            res.status(400).end();
        }
    }
}