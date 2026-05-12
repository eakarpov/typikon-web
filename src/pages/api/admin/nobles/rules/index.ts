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
        res.status(405).end();
    } else {
        try {
            const search = req.query.query || "";
            const db = await init();

            const dataNobles = await db.prepare(`
                SELECT *
                FROM nobles
                WHERE ROWID IN (SELECT ROWID FROM nobles_text WHERE name LIKE '%${search}%' ORDER BY rank)`)
                .all();

            const dataRequest = await db.prepare(`select * from rules where personId=?`);

            const data: any[] = [];
            for (const item of dataNobles) {
                data.push(...dataRequest.all(
                    item.id,
                ).map((r) => ({
                    ...r,
                    person: item,
                })));
            }

            res.json({
                data,
            });
        } catch (e) {
            console.log("mongodb error", e);
            res.status(400).end();
        }
    }
}