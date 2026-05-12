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
        const id = req.query.id as string;
        const data = JSON.parse(req.body as string);
        try {
            const db = await init();

            db.prepare(`delete from rules where personId = ?`).run(id);

            const insert = db.prepare(`INSERT INTO rules (
                stateId,
                personId,
                predessorId,
                heirId,
                suzerainId,
                regentId,
                startDate,
                endDate,
                title,
                regentTitle
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            const insertMany = db.transaction((cats) => {
                for (const item of cats) {
                    insert.run(
                        item.stateId,
                        id,
                        item.predessorId || null,
                        item.heirId || null,
                        item.suzerainId || null,
                        item.regentId || null,
                        item.startDate,
                        item.endDate,
                        item.title,
                        item.regentTitle,
                    );
                }
            });

            insertMany(data);

            res.status(200).end();
        } catch (e) {
            console.log("mongodb error", e);
            res.status(400).end();
        }
    } else {
        try {
            const id = req.query.id as string;
            const db = await init();

            const data = await db.prepare(`select * from rules where personId=?`).all(id);

            res.json({
                data,
            });
        } catch (e) {
            console.log("mongodb error", e);
            res.status(400).end();
        }
    }
}