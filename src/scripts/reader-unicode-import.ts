import '@/scripts/lib/env';
import assert from 'node:assert/strict';
import { BSON } from 'mongodb';
import { readFileSync, writeFileSync } from 'node:fs';
import { readerDb } from '@/lib/reader/registry';
import { ReaderService } from '@/lib/reader/service';
import { rules, loadNative } from '@/lib/reader/native';
import { profileSets, project } from '@/lib/reader/projection';
import { PILOT, canonical, sha, type Obj } from '@/lib/reader/core';
import { openIndex, verifyIndex } from '@/lib/reader/index/store';
import { dictionaryPublication } from '@/lib/csDictionary/database';
const arg = (k: string) => { const i = process.argv.indexOf(k); if (i < 0) throw Error('Required ' + k); return process.argv[i + 1]; };
async function main() {
    assert.equal(process.versions.unicode, '17.0');
    const saved = BSON.EJSON.parse(readFileSync(arg('--registry'), 'utf8')) as Obj;
    const index = openIndex(arg('--index')); verifyIndex(index);
    assert.equal(saved.runtimeUnicode, '17.0'); assert.equal(saved.pilotId, PILOT); assert.equal(saved.corpusRelease, index.manifest.corpusRelease);
    const currentNative = rules();
    let nativeRebound = false;
    if (process.argv.includes('--rebind-native')) {
        const baseline = JSON.parse(readFileSync(arg('--baseline'), 'utf8'));
        assert.equal(baseline.originalCorpusRelease, saved.previousCorpusRelease);
        const bridges = saved.collections.readerBodyRebindings ??= [];
        for (const b of saved.collections.readerBodyBindings) {
            if (b.nativeRef.namespace === 'typikon.texts' || b.datasetRevision === currentNative.datasetRevision) continue;
            const table = b.nativeRef.namespace === 'rules.fixed_texts' ? 'fixed_texts' : 'content_items', key = table === 'fixed_texts' ? 'text_id' : 'item_id';
            const row = currentNative.db.prepare(`SELECT text FROM ${table} WHERE ${key}=?`).get(b.nativeRef.id) as Obj;
            assert.ok(row); assert.equal('br1_' + sha(row.text), b.bodyRevision, 'Server native rebind requires exact original bytes');
            const id = b._id + ':' + currentNative.datasetRevision;
            if (!bridges.some((v: Obj) => v._id === id)) bridges.push({ _id: id, bodyId: b.bodyId, bodyRevision: b.bodyRevision, fromDatasetRevision: b.datasetRevision, datasetRevision: currentNative.datasetRevision, nativeRef: b.nativeRef, basis: 'server-native-bridge: same ref + exact raw + full Unicode16/17 projection comparison', baselineSha256: sha(readFileSync(arg('--baseline'))) });
        }
        saved.nativeDatasetRevision = currentNative.datasetRevision; nativeRebound = true;
    }
    assert.equal(currentNative.datasetRevision, saved.nativeDatasetRevision, 'Native artifact must match an audited bridge set');
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
        const live = await loadNative(reader.db, e.nativeRef);
        assert.equal(live.items.length, s.descriptor.units.length, 'Current native placement count must preserve pilot source');
        for (let i = 0; i < live.items.length; i++) assert.equal('br1_' + sha(live.items[i].raw), s.descriptor.units[i].bodyRevision, 'Legacy numeric/native source sequence must preserve text identity');
        for (const u of s.descriptor.units) { await reader.body(s.entry, u); bodies.add(u.bodyId + ':' + u.bodyRevision); units++; }
    }
    assert.equal(units, 68); assert.equal(bodies.size, 67);
    let projectionsCompared = 0;
    if (nativeRebound) {
        const baseline = JSON.parse(readFileSync(arg('--baseline'), 'utf8')), checked = new Set<string>();
        for (const e of saved.collections.readerReleases.find((r: Obj) => r._id === saved.corpusRelease).entries) {
            const state = await reader.entry({ version: 2, sourceId: e.sourceId, sourceRevision: e.sourceRevision, passportRevision: e.passportRevision });
            for (const u of state.descriptor.units) {
                const key = u.bodyId + ':' + u.bodyRevision; if (checked.has(key)) continue; checked.add(key);
                const body = await reader.body(state.entry, u);
                for (const p of profileSets) {
                    const previous = baseline.comparisons.find((v: Obj) => v.bodyId === u.bodyId && v.bodyRevision === u.bodyRevision && v.profileKind === p.id.split('-')[2]); assert.ok(previous);
                    const projection = project(body, p.id);
                    assert.equal(sha(canonical(projection.tokens)), previous.allTokensSha256);
                    assert.equal(sha(canonical(projection.map.segments)), previous.segmentsSha256);
                    assert.equal(sha(projection.viewText), previous.viewTextSha256); projectionsCompared++;
                }
            }
        }
        assert.equal(projectionsCompared, 201); assert.equal(rules().datasetRevision, currentNative.datasetRevision, 'Native artifact changed during server audit');
        if (process.argv.includes('--export')) writeFileSync(arg('--export'), BSON.EJSON.stringify(saved, { relaxed: false }) + '\n');
    }
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
    const report = { format: 'cs-reader-u17-server-import/1', staged: true, nativeRebound, projectionsCompared, nativeDatasetRevision: currentNative.datasetRevision, prepared: activate || prepare, activated: activate, nativeBodiesChecked: bodies.size, navigationUnits: units, unicode: process.versions.unicode, corpusRelease: saved.corpusRelease, indexRevision: index.manifest.indexRevision, noCanonicalTextCopied: true, globalLegacyRegistryActivated: false };
    if (process.argv.includes('--report')) writeFileSync(arg('--report'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { const {default: client} = await import('@/lib/mongodb'); await (await client).close(); });
