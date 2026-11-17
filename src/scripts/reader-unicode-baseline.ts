import '@/scripts/lib/env';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { BSON, ObjectId } from 'mongodb';
import { canonical, sha, type Obj } from '@/lib/reader/core';
import { rules } from '@/lib/reader/native';
import { project, profileSets } from '@/lib/reader/projection';
import { readerDb } from '@/lib/reader/registry';
const arg = (k: string) => process.argv[process.argv.indexOf(k) + 1];
async function main() {
    assert.equal(process.versions.unicode, '16.0');
    const saved = BSON.EJSON.parse(readFileSync(arg('--registry'), 'utf8')) as Obj, db = await readerDb(), current = rules();
    const rows = [], bodies = new Map<string, Obj>();
    for (const binding of saved.collections.readerBodyBindings) {
        let raw: string;
        if (binding.nativeRef.namespace === 'typikon.texts') raw = (await db.collection('texts').findOne({ _id: new ObjectId(binding.nativeRef.id) }))!.content;
        else { const table = binding.nativeRef.namespace === 'rules.fixed_texts' ? 'fixed_texts' : 'content_items'; const key = table === 'fixed_texts' ? 'text_id' : 'item_id'; raw = (current.db.prepare(`SELECT text FROM ${table} WHERE ${key}=?`).get(binding.nativeRef.id) as Obj).text; }
        assert.equal('br1_' + sha(raw), binding.bodyRevision, 'Unchanged raw before any Unicode comparison');
        bodies.set(binding.bodyId + ':' + binding.bodyRevision, { ...binding, raw });
    }
    for (const body of bodies.values()) for (const p of profileSets) {
        const projection = project(body, p.id);
        rows.push({ bodyId: body.bodyId, bodyRevision: body.bodyRevision, profileKind: p.id.split('-')[2], allTokensSha256: sha(canonical(projection.tokens)), segmentsSha256: sha(canonical(projection.map.segments)), viewTextSha256: sha(projection.viewText), lexicalTokens: projection.tokens.filter((t: Obj) => ['word','numberCandidate','unresolved'].includes(t.type)).length, rawLengthUtf16: body.raw.length });
    }
    const report = { format: 'cs-unicode16-projection-baseline/1', runtime: { node: process.version, unicode: process.versions.unicode, icu: process.versions.icu }, nativeDatasetRevision: current.datasetRevision, originalCorpusRelease: saved.corpusRelease, bodies: bodies.size, comparisons: rows };
    writeFileSync(arg('--report'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ bodies: bodies.size, projections: rows.length, rawUnchanged: true }));
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { const {default: client} = await import('@/lib/mongodb'); await (await client).close(); });
