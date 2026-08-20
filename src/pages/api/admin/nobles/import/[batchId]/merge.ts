import {NextApiRequest, NextApiResponse} from "next";
import {checkRightsBack} from "@/lib/admin/back";
import {init} from "@/lib/sqlite";

// Мердж партии staging_* в живые nobles/families/couples. Идемпотентен: опирается на
// nobles.wikidataId/families.wikidataId (UNIQUE) — повторный запуск на той же партии не плодит дублей,
// только дозаполняет то, что осталось не смержено (например, если часть персон ещё pending).
//
// Правило "не затирать руками введённое": для уже сопоставленной записи (matchedNobleId) поля
// заполняются только если сейчас пустые (birthDate/deathDate/isSaintOrthodox/fatherId/motherId) —
// значения, введённые вручную, никогда не перезаписываются импортом.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method !== "POST") {
        res.status(405).end();
        return;
    }
    if (!(await checkRightsBack(req, res))) return;

    const batchId = req.query.batchId as string;

    try {
        const db = await init();

        const run = db.transaction(() => {
            // --- 1. Роды: создаём/сопоставляем по имени, привязываем wikidataId для будущей идемпотентности ---
            const stagingFamilies = db
                .prepare(`select * from staging_families where batchId = ? and status != 'merged'`)
                .all(batchId) as any[];

            let mergedFamilies = 0;
            for (const f of stagingFamilies) {
                let familyId: number | null = f.matchedFamilyId;
                if (!familyId) {
                    const byWid = db.prepare(`select id from families where wikidataId = ?`).get(f.wikidataId) as
                        | {id: number}
                        | undefined;
                    familyId = byWid?.id ?? null;
                }
                if (!familyId) {
                    const info = db.prepare(`insert into families (name, wikidataId) values (?, ?)`).run(f.name, f.wikidataId);
                    familyId = info.lastInsertRowid as number;
                } else {
                    db.prepare(`update families set wikidataId = coalesce(wikidataId, ?) where id = ?`).run(f.wikidataId, familyId);
                }
                db.prepare(`update staging_families set matchedFamilyId = ?, status = 'merged' where id = ?`).run(familyId, f.id);
                mergedFamilies++;
            }

            const familyIdByWid = new Map(
                (db.prepare(`select id, wikidataId from families where wikidataId is not null`).all() as any[]).map((r) => [
                    r.wikidataId,
                    r.id,
                ]),
            );

            // --- 2. Персоны (только одобренные админом) — проход 1: создать/сопоставить, без father/mother ---
            const approvedNobles = db
                .prepare(`select * from staging_nobles where batchId = ? and status = 'approved'`)
                .all(batchId) as any[];

            for (const n of approvedNobles) {
                let nobleId: number | null = n.matchedNobleId;
                if (!nobleId) {
                    const byWid = db.prepare(`select id from nobles where wikidataId = ?`).get(n.wikidataId) as
                        | {id: number}
                        | undefined;
                    nobleId = byWid?.id ?? null;
                }
                if (!nobleId) {
                    const familyId = n.familyWikidataId ? familyIdByWid.get(n.familyWikidataId) ?? null : null;
                    const info = db
                        .prepare(
                            `insert into nobles (name, birthDate, deathDate, birthDateMarker, deathDateMarker, gender, isSaintOrthodox, isSaintCatholic, wikidataId, familyId)
                             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        )
                        .run(n.name, n.birthDate, n.deathDate, n.birthDateMarker, n.deathDateMarker, n.gender, n.isSaintOrthodox, n.isSaintCatholic, n.wikidataId, familyId);
                    nobleId = info.lastInsertRowid as number;
                } else {
                    db.prepare(
                        `update nobles set
                            wikidataId = coalesce(wikidataId, ?),
                            birthDate = case when birthDate is null or birthDate = '' then ? else birthDate end,
                            deathDate = case when deathDate is null or deathDate = '' then ? else deathDate end,
                            birthDateMarker = case when birthDateMarker is null then ? else birthDateMarker end,
                            deathDateMarker = case when deathDateMarker is null then ? else deathDateMarker end,
                            isSaintOrthodox = case when isSaintOrthodox is null or isSaintOrthodox = 0 then ? else isSaintOrthodox end,
                            isSaintCatholic = case when isSaintCatholic is null or isSaintCatholic = 0 then ? else isSaintCatholic end
                         where id = ?`,
                    ).run(n.wikidataId, n.birthDate, n.deathDate, n.birthDateMarker, n.deathDateMarker, n.isSaintOrthodox, n.isSaintCatholic, nobleId);
                }
                db.prepare(`update staging_nobles set matchedNobleId = ?, status = 'merged' where id = ?`).run(nobleId, n.id);
            }

            // --- 3. Проход 2: father/motherId — по wikidataId-карте, только если поле сейчас пустое ---
            const widToNobleId = new Map(
                (db.prepare(`select id, wikidataId from nobles where wikidataId is not null`).all() as any[]).map((r) => [
                    r.wikidataId,
                    r.id,
                ]),
            );

            const mergedThisBatch = db
                .prepare(`select * from staging_nobles where batchId = ? and status = 'merged'`)
                .all(batchId) as any[];

            for (const n of mergedThisBatch) {
                const fatherId = n.fatherWikidataId ? widToNobleId.get(n.fatherWikidataId) ?? null : null;
                const motherId = n.motherWikidataId ? widToNobleId.get(n.motherWikidataId) ?? null : null;
                if (fatherId || motherId) {
                    db.prepare(
                        `update nobles set
                            fatherId = case when fatherId is null then ? else fatherId end,
                            motherId = case when motherId is null then ? else motherId end
                         where id = ?`,
                    ).run(fatherId, motherId, n.matchedNobleId);
                }
            }

            // --- 4. Браки — только там, где обе стороны уже смержены в этой или прошлой партии ---
            const stagingCouples = db
                .prepare(`select * from staging_couples where batchId = ? and status != 'merged'`)
                .all(batchId) as any[];

            let mergedCouples = 0;
            for (const c of stagingCouples) {
                const personId = widToNobleId.get(c.personWikidataId);
                const spouseId = widToNobleId.get(c.spouseWikidataId);
                if (!personId || !spouseId) continue; // сторона ещё не одобрена — дозачтём на следующем мердже

                const personGender = (db.prepare(`select gender from nobles where id = ?`).get(personId) as any)?.gender;
                const spouseGender = (db.prepare(`select gender from nobles where id = ?`).get(spouseId) as any)?.gender;
                let husbandId = personId;
                let wifeId = spouseId;
                if (personGender === 0 && spouseGender === 1) {
                    husbandId = spouseId;
                    wifeId = personId;
                }

                const dup = db
                    .prepare(`select id from couples where (husbandId = ? and wifeId = ?) or (husbandId = ? and wifeId = ?)`)
                    .get(husbandId, wifeId, wifeId, husbandId);
                if (!dup) {
                    db.prepare(`insert into couples (husbandId, wifeId, marriageDate, divorceDate) values (?, ?, ?, ?)`).run(
                        husbandId,
                        wifeId,
                        c.marriageDate ?? "",
                        c.divorceDate,
                    );
                    mergedCouples++;
                }
                db.prepare(`update staging_couples set status = 'merged' where id = ?`).run(c.id);
            }

            // --- 5. Правления (rules) — только одобренные админом, только если персона уже смержена ---
            const approvedRules = db
                .prepare(`select * from staging_rules where batchId = ? and status = 'approved'`)
                .all(batchId) as any[];

            let mergedRules = 0;
            for (const r of approvedRules) {
                const personId = widToNobleId.get(r.personWikidataId);
                if (!personId) continue; // персона ещё не одобрена/смержена — дозачтём на следующем мердже

                if (r.matchedRuleId) {
                    // Уже есть рукописная запись об этом правлении — только дозаполняем пустые даты,
                    // никогда не перезаписываем то, что ввели руками.
                    db.prepare(
                        `update rules set
                            startDate = case when startDate is null or startDate = '' then ? else startDate end,
                            endDate = case when endDate is null or endDate = '' then ? else endDate end
                         where id = ?`,
                    ).run(r.startDate, r.endDate, r.matchedRuleId);
                } else {
                    db.prepare(`insert into rules (stateId, personId, startDate, endDate, title) values (?, ?, ?, ?, ?)`).run(
                        r.stateId,
                        personId,
                        r.startDate,
                        r.endDate,
                        r.title,
                    );
                }
                db.prepare(`update staging_rules set status = 'merged' where id = ?`).run(r.id);
                mergedRules++;
            }

            return {mergedNobles: mergedThisBatch.length, mergedCouples, mergedFamilies, mergedRules};
        });

        const result = run();
        res.status(200).json(result);
    } catch (e) {
        console.error(e);
        res.status(400).json({error: String(e)});
    }
}
