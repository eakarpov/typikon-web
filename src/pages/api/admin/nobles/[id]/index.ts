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

            db.prepare(`update nobles set 
                  name = ?,
                  englishName = ?,
                  originalName = ?,
                  gender = ?,
                  familyId = ?,
                  defaultNationalityId = ?,
                  fatherId = ?,
                  motherId = ?,
                  birthDate = ?,
                  deathDate = ?,
                  isSaintCatholic = ?,
                  isSaintOrthodox = ?,
                  csName = ?,
                  nickName = ?,
                  churchName = ?,
                  info = ?,
                  birthDateMarker = ?,
                  deathDateMarker = ?,
                  rank = ?
              where id = ?`)
                .run(
                    data.name,
                    data.englishName,
                    data.originalName,
                    data.gender,
                    data.familyId || null,
                    data.defaultNationalityId || null,
                    data.fatherId || null,
                    data.motherId || null,
                    data.birthDate,
                    data.deathDate,
                    data.isSaintCatholic,
                    data.isSaintOrthodox,
                    data.csName,
                    data.nickName,
                    data.churchName,
                    data.info,
                    parseInt(data.birthDateMarker, 10),
                    parseInt(data.deathDateMarker, 10),
                    parseInt(data.rank),
                    parseInt(id)
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

            const data = await db.prepare(`select * from nobles where id=?`).get(id);

            res.json({
                data,
            });
        } catch (e) {
            console.log("mongodb error", e);
            res.status(400).end();
        }
    }
}