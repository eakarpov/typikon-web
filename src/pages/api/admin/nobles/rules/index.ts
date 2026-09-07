import { NextApiRequest, NextApiResponse } from 'next'
import clientPromise from "@/lib/mongodb";
import {checkRightsBack} from "@/lib/admin/back";
import {init} from "@/lib/sqlite";
import type {NobleRow, RuleRow} from "@/lib/nobles/types";
import {reportError} from "@/lib/reportError";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method === 'POST') {
        if (!(await checkRightsBack(req, res))) return;
        res.status(405).end();
    } else {
        try {
            const search = req.query.query || "";
            const db = await init();

            const dataNobles = await db.prepare(`
                SELECT *
                FROM nobles
                WHERE ROWID IN (SELECT ROWID FROM nobles_text WHERE name LIKE ? ORDER BY rank)`)
                .all(`%${search}%`) as NobleRow[];

            const dataRequest = await db.prepare(`select * from rules where personId=?`);

            const data: (RuleRow & { person: NobleRow })[] = [];
            for (const item of dataNobles) {
                data.push(...(dataRequest.all(
                    item.id,
                ) as RuleRow[]).map((r) => ({
                    ...r,
                    person: item,
                })));
            }

            res.json({
                data,
            });
        } catch (e) {
            reportError(e, { where: "pages/api/admin/nobles/rules/index#handler", source: "api" });
            res.status(400).end();
        }
    }
}