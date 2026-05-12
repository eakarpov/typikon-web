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

            const nobleData = await db.prepare(`select * from nobles where id= ?`).get(id);

            const isMale = !!nobleData.gender;

            const h = db.prepare(`delete from couples where husbandId = ?`);

            const w= db.prepare(`delete from couples where wifeId = ?`)

            if (isMale) {
                h.run(id);
            } else {
                w.run(id);
            }

            const insert = db.prepare(`INSERT INTO couples (
                     husbandId, wifeId, marriageDate, divorcedate
            ) VALUES (?, ?, ?, ?)`);

            const insertMany = db.transaction((cats) => {
                for (const item of cats) {
                    console.log(item);
                    insert.run(
                        isMale ? id : item.person,
                        isMale ? item.person : id,
                        item.marriageDate,
                        item.divorcedate || null,
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

            const data = await db.prepare(`select * from nobles where id= ?`).get(id);

            const isMale = !!data.gender;

            const result = await db.prepare(`select * from couples where husbandId = ? or wifeId = ?`).all(
                id,
                id
            );

            const answer = result
                .filter((item) => isMale ? item.husbandId === parseInt(id) : item.wifeId === parseInt(id) );
            res.json({
                data: answer,
            });
        } catch (e) {
            console.log("mongodb error", e);
            res.status(400).end();
        }
    }
}