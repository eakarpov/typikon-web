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

            // --- 6. Дубли персон — сливаем duplicate в canonical: дозаполняем пустые поля canonical
            // из duplicate, перевешиваем все ссылки (father/motherId, rules.personId, couples,
            // nationalities_nobles, и ожидающие пары того же батча — на случай цепочки A=B, B=C) на
            // canonical, затем удаляем duplicate. Ничего руками введённое в canonical не перезаписываем.
            const approvedDupIds = (db.prepare(`select id from staging_noble_duplicates where batchId = ? and status = 'approved'`).all(batchId) as any[]).map((r) => r.id);

            let mergedDuplicates = 0;
            for (const stagingId of approvedDupIds) {
                const row = db.prepare(`select * from staging_noble_duplicates where id = ?`).get(stagingId) as any;
                if (!row || row.status === "merged") continue;
                const {canonicalNobleId, duplicateNobleId} = row;
                if (canonicalNobleId === duplicateNobleId) {
                    db.prepare(`update staging_noble_duplicates set status = 'merged' where id = ?`).run(stagingId);
                    continue;
                }
                const dup = db.prepare(`select * from nobles where id = ?`).get(duplicateNobleId) as any;
                if (!dup) {
                    // уже удалена более ранней парой в этой же партии — просто закрываем строку
                    db.prepare(`update staging_noble_duplicates set status = 'merged' where id = ?`).run(stagingId);
                    continue;
                }

                // better-sqlite3 включает foreign_keys по умолчанию — прежде чем удалять duplicate,
                // нужно перевесить ВСЕ ссылки на неё (иначе DELETE упадёт на FK), и только потом можно
                // безопасно перенести её wikidataId и т.п. на canonical (перенос ДО удаления столкнул бы
                // два wikidataId на разных строках и упал бы уже на UNIQUE-индексе).
                db.prepare(`update nobles set fatherId = ? where fatherId = ?`).run(canonicalNobleId, duplicateNobleId);
                db.prepare(`update nobles set motherId = ? where motherId = ?`).run(canonicalNobleId, duplicateNobleId);
                db.prepare(`update rules set personId = ? where personId = ?`).run(canonicalNobleId, duplicateNobleId);
                db.prepare(`update rules set heirId = ? where heirId = ?`).run(canonicalNobleId, duplicateNobleId);
                db.prepare(`update rules set regentId = ? where regentId = ?`).run(canonicalNobleId, duplicateNobleId);
                db.prepare(`update nationalities_nobles set personId = ? where personId = ?`).run(canonicalNobleId, duplicateNobleId);
                db.prepare(`update staging_nobles set matchedNobleId = ? where matchedNobleId = ?`).run(canonicalNobleId, duplicateNobleId);
                db.prepare(`update staging_dneslov_links set nobleId = ? where nobleId = ?`).run(canonicalNobleId, duplicateNobleId);

                const dupCouples = db.prepare(`select * from couples where husbandId = ? or wifeId = ?`).all(duplicateNobleId, duplicateNobleId) as any[];
                for (const c of dupCouples) {
                    const newHusband = c.husbandId === duplicateNobleId ? canonicalNobleId : c.husbandId;
                    const newWife = c.wifeId === duplicateNobleId ? canonicalNobleId : c.wifeId;
                    const already = db
                        .prepare(`select id from couples where id != ? and ((husbandId = ? and wifeId = ?) or (husbandId = ? and wifeId = ?))`)
                        .get(c.id, newHusband, newWife, newWife, newHusband);
                    if (already) db.prepare(`delete from couples where id = ?`).run(c.id);
                    else db.prepare(`update couples set husbandId = ?, wifeId = ? where id = ?`).run(newHusband, newWife, c.id);
                }

                // Ожидающие пары этой же партии могли ссылаться на только что растворившуюся duplicate —
                // перенаправляем на canonical, чтобы не потерять и не сломать цепочку (A=B, B=C).
                db.prepare(`update staging_noble_duplicates set canonicalNobleId = ? where canonicalNobleId = ? and status != 'merged'`).run(canonicalNobleId, duplicateNobleId);
                db.prepare(`update staging_noble_duplicates set duplicateNobleId = ? where duplicateNobleId = ? and status != 'merged'`).run(canonicalNobleId, duplicateNobleId);

                // Все ссылки перевешены — теперь можно удалить duplicate без нарушения FK.
                db.prepare(`delete from nobles where id = ?`).run(duplicateNobleId);

                db.prepare(
                    `update nobles set
                        wikidataId = coalesce(wikidataId, ?),
                        dneslovId = coalesce(dneslovId, ?),
                        birthDate = case when birthDate is null or birthDate = '' then ? else birthDate end,
                        deathDate = case when deathDate is null or deathDate = '' then ? else deathDate end,
                        birthDateMarker = case when birthDateMarker is null then ? else birthDateMarker end,
                        deathDateMarker = case when deathDateMarker is null then ? else deathDateMarker end,
                        churchName = case when churchName is null or churchName = '' then ? else churchName end,
                        csName = case when csName is null or csName = '' then ? else csName end,
                        nickName = case when nickName is null or nickName = '' then ? else nickName end,
                        info = case when info is null or info = '' then ? else info end,
                        isSaintOrthodox = max(isSaintOrthodox, ?),
                        isSaintCatholic = max(isSaintCatholic, ?)
                     where id = ?`,
                ).run(
                    dup.wikidataId, dup.dneslovId, dup.birthDate, dup.deathDate, dup.birthDateMarker, dup.deathDateMarker,
                    dup.churchName, dup.csName, dup.nickName, dup.info, dup.isSaintOrthodox, dup.isSaintCatholic,
                    canonicalNobleId,
                );

                db.prepare(`update staging_noble_duplicates set status = 'merged' where id = ?`).run(stagingId);
                mergedDuplicates++;
            }

            // --- 7. Связи со святыми (dneslov) — только одобренные, только если персона ещё существует
            // (могла раствориться в дубль-мердже выше — тогда просто дозачтём на следующем прогоне).
            const approvedDneslov = db.prepare(`select * from staging_dneslov_links where batchId = ? and status = 'approved'`).all(batchId) as any[];
            let mergedDneslov = 0;
            for (const l of approvedDneslov) {
                const noble = db.prepare(`select id, dneslovId from nobles where id = ?`).get(l.nobleId) as any;
                if (!noble) continue;
                db.prepare(`update nobles set dneslovId = coalesce(dneslovId, ?) where id = ?`).run(l.dneslovId, l.nobleId);
                db.prepare(`update staging_dneslov_links set status = 'merged' where id = ?`).run(l.id);
                mergedDneslov++;
            }

            return {mergedNobles: mergedThisBatch.length, mergedCouples, mergedFamilies, mergedRules, mergedDuplicates, mergedDneslov};
        });

        const result = run();
        res.status(200).json(result);
    } catch (e) {
        console.error(e);
        res.status(400).json({error: String(e)});
    }
}
