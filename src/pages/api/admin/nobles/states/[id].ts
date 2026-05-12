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

            db.prepare(`update states set 
                  name = ?,
                  defaultTitle = ?,
                  predessorId = ?,
                  surnames = ?
              where id = ?`)
                .run(
                    data.name,
                    data.title,
                    data.predessorId || null,
                    data.surnames,
                    parseInt(id),
                );

            res.status(200).end();
        } catch (e) {
            console.log("mongodb error", e);
            res.status(400).end();
        }
    } else {
        try {
            const id = req.query.id as string;
            const db = await init();

            const data = await db.prepare(`select * from states where id=?`).get(id);

            res.json({
                data,
            });
        } catch (e) {
            console.log("mongodb error", e);
            res.status(400).end();
        }
    }
}