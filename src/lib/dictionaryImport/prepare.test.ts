import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';

test('a truncated gzip cannot produce a complete staging database even after many valid articles', () => {
    const dir = mkdtempSync(join(tmpdir(), 'chu-rus-truncated-'));
    try {
        const source = ['#NAME "Fixture"', ...Array.from({ length: 120 }, (_, i) =>
            `слово${i}:\n\t[m0][p]gr[/p] CONJ[/m]`)].join('\n');
        const compressed = gzipSync(Buffer.from(source));
        const dsl = join(dir, 'broken.dsl.dz'), lexemes = join(dir, 'lexemes.json'), out = join(dir, 'out.sqlite');
        writeFileSync(dsl, compressed.subarray(0, compressed.length - 8));
        writeFileSync(lexemes, '[]');
        const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/scripts/prepare-chu-rus.ts',
            '--dsl', dsl, '--lexems', lexemes, '--out', out], { encoding: 'utf8', timeout: 20000 });
        assert.notEqual(result.status, 0, result.stdout + result.stderr);
        assert.equal(existsSync(out + '.summary.json'), false);
        if (existsSync(out)) {
            const db = new Database(out, { readonly: true });
            try { assert.notEqual((db.prepare("SELECT value FROM metadata WHERE key='state'").get() as {value:string}).value, 'complete'); }
            finally { db.close(); }
        }
    } finally { rmSync(dir, { recursive: true, force: true }); }
});
