import '@/scripts/lib/env';
import assert from 'node:assert/strict';
import { BSON } from 'mongodb';
import { readFileSync, writeFileSync } from 'node:fs';
import { readerDb } from '@/lib/reader/registry';
import { ReaderService } from '@/lib/reader/service';
import { rules } from '@/lib/reader/native';
import { profileSets } from '@/lib/reader/projection';
import { PILOT, canonical, type Obj } from '@/lib/reader/core';
import { openIndex, verifyIndex } from '@/lib/reader/index/store';
import { dictionaryPublication } from '@/lib/csDictionary/database';
const arg = (k: string) => { const i = process.argv.indexOf(k); if (i < 0) throw Error('Required ' + k); return process.argv[i + 1]; };
async function main() {
    assert.equal(process.versions.unicode, '17.0');
    const saved = BSON.EJSON.parse(readFileSync(arg('--registry'), 'utf8')) as Obj;
    const index = openIndex(arg('--index')); verifyIndex(index);
    assert.equal(saved.runtimeUnicode, '17.0'); assert.equal(saved.pilotId, PILOT); assert.equal(saved.corpusRelease, index.manifest.corpusRelease);
    assert.equal(rules().datasetRevision, saved.nativeDatasetRevision, 'Native artifact must be identical to audited build');
    assert.equal(dictionaryPublication().version, index.manifest.dictionaryVersion, 'Pinned D must match deployed dictionary');
    const { default: connection } = await import('@/lib/mongodb'); const client = await connection, native = client.db('typikon'), stage = client.db('typikon_reader_m202_u17');
    // Stage only immutable sidecars, never canonical texts/books or dictionary rows.
    for (const [name, rows] of Object.entries(saved.collections) as [string, Obj[]][]) {
        assert.ok(/^reader[A-Z][A-Za-z]+$/.test(name));
        for (const row of rows) await stage.collection<any>(name).replaceOne({ _id: row._id }, row, { upsert: true });
    }
    process.env.CS_READER_REGISTRY_DB = 'typikon_reader_m202_u17';
    const reader = new ReaderService(await readerDb()); let units = 0; const bodies = new Set<string>();
    for (const e of saved.collections.readerReleases.find((r: Obj) => r._id === saved.corpusRelease).entries) {
        const s = await reader.entry({ version: 2, sourceId: e.sourceId, sourceRevision: e.sourceRevision, passportRevision: e.passportRevision });
        for (const u of s.descriptor.units) { await reader.body(s.entry, u); bodies.add(u.bodyId + ':' + u.bodyRevision); units++; }
    }
    assert.equal(units, 68); assert.equal(bodies.size, 67);
    for (const p of profileSets) assert.equal(canonical((await stage.collection<any>('readerProfiles').findOne({ _id: p.id }))!.profile), canonical(p));
    const activate = process.argv.includes('--activate'), prepare = process.argv.includes('--prepare');
    assert.ok(!(activate && prepare));
    if (activate || prepare) {
        const previous = await native.collection<any>('readerPilots').findOne({ _id: PILOT });
        if (previous) assert.ok([saved.corpusRelease, saved.previousCorpusRelease].includes(previous.activeRelease), 'Concurrent publication must not be overwritten');
        const before = BSON.EJSON.stringify({ pilot: previous }, { relaxed: false });
        if (process.argv.includes('--backup')) writeFileSync(arg('--backup'), before + '\n', { flag: 'wx' });
        for (const [name, rows] of Object.entries(saved.collections) as [string, Obj[]][]) {
            if (name === 'readerPilots') continue;
            for (const row of rows) { const existing = await native.collection<any>(name).findOne({ _id: row._id }); if (existing) assert.equal(BSON.EJSON.stringify(existing, { relaxed: false }), BSON.EJSON.stringify(row, { relaxed: false }), 'Existing immutable record conflict: ' + name); }
        }
        for (const [name, rows] of Object.entries(saved.collections) as [string, Obj[]][]) {
            if (name === 'readerPilots') continue;
            for (const row of rows) await native.collection<any>(name).updateOne({ _id: row._id }, { $setOnInsert: row }, { upsert: true });
        }
        if (activate) {
            const published = saved.collections.readerPilots.find((s: Obj) => s._id === PILOT); assert.equal(published.legacyRegistryActive, false);
            await native.collection<any>('readerPilots').replaceOne({ _id: PILOT }, published, { upsert: true });
        }
    }
    index.db.close();
    const report = { format: 'cs-reader-u17-server-import/1', staged: true, prepared: activate || prepare, activated: activate, nativeBodiesChecked: bodies.size, navigationUnits: units, unicode: process.versions.unicode, corpusRelease: saved.corpusRelease, indexRevision: index.manifest.indexRevision, noCanonicalTextCopied: true, globalLegacyRegistryActivated: false };
    if (process.argv.includes('--report')) writeFileSync(arg('--report'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { const {default: client} = await import('@/lib/mongodb'); await (await client).close(); });
