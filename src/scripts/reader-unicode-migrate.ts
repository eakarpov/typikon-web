import '@/scripts/lib/env';
import assert from 'node:assert/strict';
import { BSON } from 'mongodb';
import Database from 'better-sqlite3';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readerDb } from '@/lib/reader/registry';
import { ReaderService } from '@/lib/reader/service';
import { rules } from '@/lib/reader/native';
import { profileSets, project } from '@/lib/reader/projection';
import { canonical, PILOT, revision, sha, type Obj } from '@/lib/reader/core';
import { buildIndex, openIndex, verifyIndex, type Review } from '@/lib/reader/index/store';
import { DictionaryPublication } from '@/lib/csDictionary/database';
const arg = (k: string) => { const i = process.argv.indexOf(k); if (i < 0) throw Error('Required ' + k); return process.argv[i + 1]; };
async function main() {
    assert.equal(process.versions.unicode, '17.0');
    assert.equal(process.env.CS_READER_REGISTRY_DB, 'typikon_reader_m202_u17', 'Isolated sidecar registry required');
    const saved = BSON.EJSON.parse(readFileSync(arg('--registry'), 'utf8')) as Obj;
    const baseline = JSON.parse(readFileSync(arg('--baseline'), 'utf8'));
    const prior = openIndex(arg('--old-index')); verifyIndex(prior);
    const reviews: Review[] = JSON.parse(readFileSync(arg('--reviews'), 'utf8')).reviews;
    const output = arg('--output'); mkdirSync(output, { recursive: true });
    const { default: connection } = await import('@/lib/mongodb'); const client = await connection;
    const stage = client.db(process.env.CS_READER_REGISTRY_DB); await stage.dropDatabase();
    for (const [name, rows] of Object.entries(saved.collections) as [string, Obj[]][]) {
        assert.ok(name.startsWith('reader')); if (rows.length) await stage.collection(name).insertMany(rows);
    }
    const db = await readerDb(), current = rules();
    const original = await db.collection<any>('readerReleases').findOne({ _id: saved.corpusRelease }); assert.ok(original);
    let bridged = 0;
    for (const binding of saved.collections.readerBodyBindings) {
        if (binding.nativeRef.namespace === 'typikon.texts' || binding.datasetRevision === current.datasetRevision) continue;
        const table = binding.nativeRef.namespace === 'rules.fixed_texts' ? 'fixed_texts' : 'content_items', key = table === 'fixed_texts' ? 'text_id' : 'item_id';
        const row = current.db.prepare(`SELECT text FROM ${table} WHERE ${key}=?`).get(binding.nativeRef.id) as Obj;
        assert.equal('br1_' + sha(row.text), binding.bodyRevision, 'Native rebind requires exact raw');
        await db.collection<any>('readerBodyRebindings').insertOne({ _id: binding._id + ':' + current.datasetRevision, bodyId: binding.bodyId, bodyRevision: binding.bodyRevision, fromDatasetRevision: binding.datasetRevision, datasetRevision: current.datasetRevision, nativeRef: binding.nativeRef, basis: 'unchanged-native-ref-and-exact-raw-sha256; full Unicode16/17 token-map comparison required before export' }); bridged++;
    }
    for (const p of profileSets) {
        const old = await db.collection<any>('readerProfiles').findOne({ _id: p.id }); if (old) assert.equal(canonical(old.profile), canonical(p));
        else await db.collection<any>('readerProfiles').insertOne({ _id: p.id, profile: p });
    }
    const releaseId = revision('release1', { pilotId: PILOT, entries: original.entries, profiles: profileSets.map(p => p.id) });
    await db.collection<any>('readerReleases').insertOne({ ...original, _id: releaseId, profiles: profileSets.map(p => p.id), createdAt: new Date(), migrationFrom: saved.corpusRelease });
    await db.collection<any>('readerPilots').updateOne({ _id: PILOT }, { $set: { activeRelease: releaseId, legacyRegistryActive: false }, $addToSet: { history: releaseId } });
    const reader = new ReaderService(db), bodies = new Map<string, Obj>(); let placements = 0;
    for (const entry of original.entries) {
        const state = await reader.entry({ version: 2, sourceId: entry.sourceId, sourceRevision: entry.sourceRevision, passportRevision: entry.passportRevision });
        for (const u of state.descriptor.units) { const body = await reader.body(state.entry, u); bodies.set(body.bodyId + ':' + body.bodyRevision, body); placements++; }
    }
    let compared = 0, lexicalCompared = 0;
    for (const body of bodies.values()) for (const p of profileSets) {
        const previous = baseline.comparisons.find((v: Obj) => v.bodyId === body.bodyId && v.bodyRevision === body.bodyRevision && v.profileKind === p.id.split('-')[2]); assert.ok(previous);
        const projection = project(body, p.id);
        assert.equal(sha(canonical(projection.tokens)), previous.allTokensSha256, 'All token IDs/ranges/keys/flags must survive Unicode upgrade');
        assert.equal(sha(canonical(projection.map.segments)), previous.segmentsSha256, 'UTF16 map segments must survive Unicode upgrade');
        assert.equal(sha(projection.viewText), previous.viewTextSha256); assert.equal(body.raw.length, previous.rawLengthUtf16);
        compared++; lexicalCompared += previous.lexicalTokens;
        if (!p.id.includes('letterfold')) {
            const oldTokens = (prior.db.prepare('SELECT payload FROM tokens WHERE body_key=? ORDER BY position').all(body.bodyId + ':' + body.bodyRevision) as Obj[]).map(t => JSON.parse(t.payload));
            const anchored = (tokens: Obj[]) => sha(canonical(tokens.map(({ surfaceRanges, ...token }) => token)));
            assert.equal(anchored(projection.tokens.filter((t: Obj) => ['word','numberCandidate','unresolved'].includes(t.type))), anchored(oldTokens), 'Token identity/keys/raw ranges versus immutable old index; display offsets checked against same-profile baseline');
        }
    }
    prior.db.close();
    const sql = new Database(arg('--dictionary'), { readonly: true, fileMustExist: true });
    let built: Awaited<ReturnType<typeof buildIndex>>;
    try { const dictionary = new DictionaryPublication(sql); assert.equal(dictionary.version, reviews[0].dictionaryVersion); built = await buildIndex(reader, { outputDir: output, dictionary, reviews }); } finally { sql.close(); }
    const indexed = openIndex(built.path); try {
        assert.equal((indexed.db.prepare('SELECT count(*) n FROM accepted_links').get() as Obj).n, 4);
        for (const review of reviews) assert.equal((indexed.db.prepare('SELECT payload FROM reviews WHERE id=?').get(review.id) as Obj).payload, canonical(review));
    } finally { indexed.db.close(); }
    const collections: Obj = {};
    for (const c of await stage.listCollections().toArray()) collections[c.name] = await stage.collection(c.name).find({}).toArray();
    const exportText = BSON.EJSON.stringify({ format: 'cs-reader-unicode17-export/1', pilotId: PILOT, corpusRelease: releaseId, previousCorpusRelease: saved.corpusRelease, runtimeUnicode: '17.0', nativeDatasetRevision: current.datasetRevision, fullBodiesStored: false, collections }, { relaxed: false }) + '\n';
    writeFileSync(join(output, 'reader-registry-u17.ejson'), exportText);
    const report = { format: 'm2-02-unicode17-migration/1', runtime: { node: process.version, unicode: process.versions.unicode, icu: process.versions.icu }, previousCorpusRelease: saved.corpusRelease, corpusRelease: releaseId, indexRevision: built.manifest.indexRevision, bodiesCompared: bodies.size, navigationUnits: placements, projectionsCompared: compared, lexicalTokenComparisons: lexicalCompared, tokenChanges: 0, mapSegmentChanges: 0, rawChanges: 0, addressAndSourceIdChanges: 0, acceptedLinksPreserved: reviews.length, acceptedReviewRecordsByteIdentical: true, verifiedNativeBridges: bridged, nativeDatasetRevision: current.datasetRevision, registrySha256: sha(exportText), build: built, productionModified: false };
    writeFileSync(arg('--report'), JSON.stringify(report, null, 2) + '\n'); writeFileSync(join(output, 'build.json'), JSON.stringify(built, null, 2) + '\n');
    console.log(JSON.stringify({ indexRevision: report.indexRevision, projectionsCompared: compared, tokenChanges: 0, mapSegmentChanges: 0, acceptedLinksPreserved: reviews.length, verifiedNativeBridges: bridged }));
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { const {default: client} = await import('@/lib/mongodb'); await (await client).close(); });
