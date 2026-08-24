import {init} from "@/lib/sqlite";

export const getBatchDetail = async (batchId: string) => {
    try {
        const db = await init();

        const batch = await db.prepare(`select * from import_batches where id = ?`).get(batchId);
        if (!batch) return [null, {error: "not found"}];

        const nobles = await db.prepare(`
            select sn.*, n.name as matchedName, n.birthDate as matchedBirthDate,
                   n.deathDate as matchedDeathDate, n.isSaintOrthodox as matchedIsSaintOrthodox
            from staging_nobles sn
            left join nobles n on n.id = sn.matchedNobleId
            where sn.batchId = ?
            order by sn.isBoundary asc, sn.name asc
        `).all(batchId);

        const families = await db.prepare(`
            select sf.*, f.name as matchedFamilyName
            from staging_families sf
            left join families f on f.id = sf.matchedFamilyId
            where sf.batchId = ?
            order by sf.name asc
        `).all(batchId);

        const couplesCount = await db.prepare(`select count(*) as c from staging_couples where batchId = ?`).get(batchId) as { c: number };

        const rules = await db.prepare(`
            select sr.*, n.name as personName, n.id as personNobleId, s.name as stateName,
                   r.startDate as matchedStartDate, r.endDate as matchedEndDate
            from staging_rules sr
            left join nobles n on n.wikidataId = sr.personWikidataId
            join states s on s.id = sr.stateId
            left join rules r on r.id = sr.matchedRuleId
            where sr.batchId = ?
            order by n.name asc
        `).all(batchId);

        const duplicates = await db.prepare(`
            select sd.*, a.birthDate as canonicalBirthDate, a.deathDate as canonicalDeathDate,
                   b.birthDate as duplicateBirthDate, b.deathDate as duplicateDeathDate
            from staging_noble_duplicates sd
            join nobles a on a.id = sd.canonicalNobleId
            join nobles b on b.id = sd.duplicateNobleId
            where sd.batchId = ?
            order by sd.confidence desc, sd.canonicalName asc
        `).all(batchId);

        const dneslovLinks = await db.prepare(`
            select sl.*, n.name as nobleName, n.birthDate as nobleBirthDate, n.deathDate as nobleDeathDate
            from staging_dneslov_links sl
            join nobles n on n.id = sl.nobleId
            where sl.batchId = ?
            order by sl.confidence desc, n.name asc
        `).all(batchId);

        return [{ batch, nobles, families, couplesCount: couplesCount.c, rules, duplicates, dneslovLinks }, null];
    } catch (e) {
        console.error(e);
        return [null, {error: e}];
    }
};
