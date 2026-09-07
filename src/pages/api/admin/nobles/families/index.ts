import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {init} from "@/lib/sqlite";
import {reportError} from "@/lib/reportError";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method === 'POST') {
        if (!(await checkRightsBack(req, res))) return;
        try {
            const db = await init();

            db.exec(`insert into families DEFAULT VALUES`);

            res.status(200).end();
        } catch (e) {
            reportError(e, { where: "pages/api/admin/nobles/families/index#handler", source: "api" });
            res.status(400).end();
        }
    } else {
        try {
            const search = req.query.query || "";
            const db = await init();

            const data = await db.prepare(`
                SELECT *
                FROM families
                WHERE ROWID IN (SELECT ROWID FROM families_text WHERE name LIKE ? ORDER BY rank)`)
                .all(`%${search}%`);

            res.json({
                data,
            });
        } catch (e) {
            reportError(e, { where: "pages/api/admin/nobles/families/index#handler", source: "api" });
            res.status(400).end();
        }
    }
}