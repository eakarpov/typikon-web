import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { loadBody, rules } from './native';
import { sha } from './core';
import { legacyNativeId, legacyPublicIds } from './legacy';
test('old raw revision only reads through an explicit current-dataset bridge and still verifies exact bytes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'reader-bridge-')), path = join(dir, 'rules.db'), previous = process.env.RULES_DB;
    const sql = new Database(path); sql.exec('CREATE TABLE fixed_texts(text_id TEXT PRIMARY KEY,text TEXT)'); sql.prepare('INSERT INTO fixed_texts VALUES(?,?)').run('one', 'Сло́во'); sql.prepare('INSERT INTO fixed_texts VALUES(?,?)').run('other', 'Иное'); sql.close(); process.env.RULES_DB = path;
    let bridge: any = null;
    const db: any = { collection(name: string) { assert.equal(name, 'readerBodyRebindings'); return { async findOne(filter: any) { return bridge && Object.entries(filter).every(([k, v]) => bridge[k] === v) ? bridge : null; } }; } };
    const binding = { _id: 'old-binding', bodyId: 'body', bodyRevision: 'br1_' + sha('Сло́во'), datasetRevision: 'ds-old', nativeRef: { namespace: 'rules.fixed_texts', id: 'one' } };
    try {
        await assert.rejects(loadBody(db, binding), (e: any) => e.status === 410);
        bridge = { _id: binding._id + ':' + rules().datasetRevision, bodyId: binding.bodyId, bodyRevision: binding.bodyRevision, fromDatasetRevision: binding.datasetRevision, datasetRevision: rules().datasetRevision, nativeRef: binding.nativeRef };
        assert.equal(await loadBody(db, binding), 'Сло́во');
        bridge.nativeRef = { namespace: 'rules.fixed_texts', id: 'other' };
        await assert.rejects(loadBody(db, binding), (e: any) => e.status === 410);
    } finally { if (previous === undefined) delete process.env.RULES_DB; else process.env.RULES_DB = previous; rmSync(dir, { recursive: true, force: true }); }
});
test('publishing a scoped pilot does not activate global legacy numeric IDs', async () => {
    const db: any = { collection(name: string) { assert.equal(name, 'readerPilots'); return { async findOne() { return { activeRelease: 'new', legacyRegistryActive: false }; } }; } };
    assert.equal(await legacyNativeId(132, db), 132);
    assert.deepEqual([...await legacyPublicIds([132, 77050], db)], [[132, 132], [77050, 77050]]);
});
