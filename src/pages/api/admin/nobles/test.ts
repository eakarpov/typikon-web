import {NextApiRequest, NextApiResponse} from "next";
import {init} from "@/lib/sqlite";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    return;

    const [data] = (await import("./value.json")).default;

    const db = await init();

    const val = db.prepare(`insert into nobles DEFAULT VALUES`);

    const r =  val.run();

    const id = r.lastInsertRowid;

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
                  links = ?,
                  birthDateMarker = ?,
                  deathDateMarker = ?,
                  rank = ?
              where id = ?`)
        .run(
            data.name,
            data.englishName,
            data.originalName,
            data.gender,
            25,
            null,
            null,
            null,
            data.birthDate,
            data.deathDate,
            data.isSaintCatholic,
            data.isSaintOrthodox,
            data.csName,
            data.nickName,
            data.churchName,
            data.info,
            JSON.stringify(["https://wikipedia.org/" + data.links]),
            data.birthDateMarker,
            data.deathDateMarker,
            data.rank,
            id,
        );

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
                28,
                id,
                null,
                null,
                null,
                null,
                item.startDate,
                item.endDate,
                item.title,
                item.regentTitle,
            );
        }
    });

    insertMany(data.rules);

    res.status(200).end();

}