import {init} from "@/lib/sqlite";

export const getBatches = async () => {
    try {
        const db = await init();

        const data = await db.prepare(`
            select b.id, b.source, b.label, b.createdAt,
                (select count(*) from staging_nobles where batchId = b.id) + (select count(*) from staging_rules where batchId = b.id) as totalNobles,
                (select count(*) from staging_nobles where batchId = b.id and status = 'pending') + (select count(*) from staging_rules where batchId = b.id and status = 'pending') as pendingNobles,
                (select count(*) from staging_nobles where batchId = b.id and status = 'approved') + (select count(*) from staging_rules where batchId = b.id and status = 'approved') as approvedNobles,
                (select count(*) from staging_nobles where batchId = b.id and status = 'rejected') + (select count(*) from staging_rules where batchId = b.id and status = 'rejected') as rejectedNobles,
                (select count(*) from staging_nobles where batchId = b.id and status = 'merged') + (select count(*) from staging_rules where batchId = b.id and status = 'merged') as mergedNobles
            from import_batches b
            order by b.id desc
        `).all();

        return [data, null];
    } catch (e) {
        console.error(e);
        return [null, {error: e}];
    }
};
