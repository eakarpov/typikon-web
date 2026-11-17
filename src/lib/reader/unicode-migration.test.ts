import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { loadBody, rules, fileSha256 } from './native';
import { sha } from './core';
import { legacyNativeId, legacyPublicIds } from './legacy';
test('unrelated container changes preserve exact old bytes; moved or changed bodies never silently resolve', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'reader-bridge-')), path = join(dir, 'rules.db'), previous = process.env.RULES_DB;
    const sql = new Database(path); sql.exec('CREATE TABLE fixed_texts(text_id TEXT PRIMARY KEY,text TEXT)'); sql.prepare('INSERT INTO fixed_texts VALUES(?,?)').run('one', 'Сло́во'); sql.prepare('INSERT INTO fixed_texts VALUES(?,?)').run('other', 'Иное'); sql.close(); process.env.RULES_DB = path;
    let bridge: any = null;
    const db: any = { collection(name: string) { assert.equal(name, 'readerBodyRebindings'); return { async findOne(filter: any) { return bridge && Object.entries(filter).every(([k, v]) => bridge[k] === v) ? bridge : null; } }; } };
    const binding = { _id: 'old-binding', bodyId: 'body', bodyRevision: 'br1_' + sha('Сло́во'), datasetRevision: 'ds-old', nativeRef: { namespace: 'rules.fixed_texts', id: 'one' } };
    try {
        assert.equal(await loadBody(db, binding), 'Сло́во');
        await assert.rejects(loadBody(db, { ...binding, bodyRevision: 'br1_' + sha('Правка') }), (e: any) => e.status === 410);
        const moved = { ...binding, nativeRef: { namespace: 'rules.fixed_texts', id: 'missing' } };
        await assert.rejects(loadBody(db, moved), (e: any) => e.status === 410);
        bridge = { _id: binding._id + ':' + rules().datasetRevision, bodyId: binding.bodyId, bodyRevision: binding.bodyRevision, fromDatasetRevision: binding.datasetRevision, datasetRevision: rules().datasetRevision, nativeRef: binding.nativeRef };
        assert.equal(await loadBody(db, moved), 'Сло́во');
        bridge.nativeRef = { namespace: 'rules.fixed_texts', id: 'other' };
        await assert.rejects(loadBody(db, moved), (e: any) => e.status === 410);
    } finally { if (previous === undefined) delete process.env.RULES_DB; else process.env.RULES_DB = previous; rmSync(dir, { recursive: true, force: true }); }
});
test('publishing a scoped pilot does not activate global legacy numeric IDs', async () => {
    const db: any = { collection(name: string) { assert.equal(name, 'readerPilots'); return { async findOne() { return { activeRelease: 'new', legacyRegistryActive: false }; } }; } };
    assert.equal(await legacyNativeId(132, db), 132);
    assert.deepEqual([...await legacyPublicIds([132, 77050], db)], [[132, 132], [77050, 77050]]);
});

test('native artifact SHA256 streams multiple chunks without changing dataset identity', () => {
    const dir = mkdtempSync(join(tmpdir(), 'reader-sha-')); try {
        const bytes = Buffer.from('Сло́во\u0000'.repeat(220000) + 'end'); const path = join(dir, 'native.db'); writeFileSync(path, bytes);
        assert.equal(fileSha256(path), sha(bytes));
    } finally { rmSync(dir, { recursive: true, force: true }); }
});
