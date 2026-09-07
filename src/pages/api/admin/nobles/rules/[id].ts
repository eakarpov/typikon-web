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
        res.status(405).end();
    } else {
        if (!(await checkRightsBack(req, res))) return;
        try {
            const id = req.query.id as string;
            const db = await init();

            const data = await db.prepare(`select * from rules where id=?`).get(id) as RuleRow | undefined;

            if (!data) {
                res.status(400).end();
                return;
            }

            const person = await db.prepare(`select * from nobles where id=?`).get(data.personId) as NobleRow | undefined;

            res.json({
                data: { ...data, person },
            });
        } catch (e) {
            reportError(e, { where: "pages/api/admin/nobles/rules/[id]#handler", source: "api" });
            res.status(400).end();
        }
    }
}