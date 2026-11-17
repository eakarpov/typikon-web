import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
function fixture() { const root = mkdtempSync(join(tmpdir(), 'reader-publication-')), previous = join(root, 'old'), candidate = join(root, 'new'); for (const d of [previous, candidate]) mkdirSync(d); return { previous, candidate, run() { execFileSync(process.execPath, ['scripts/preserve-reader-publication.mjs', previous, candidate]); }, cleanup() { rmSync(root, { recursive: true, force: true }); } }; }
test('code-only release retains reader activation and immutable index without copying canonical texts', () => {
 const f = fixture(); try { mkdirSync(join(f.previous, 'data')); writeFileSync(join(f.previous, 'data/index.sqlite'), 'immutable-test'); writeFileSync(join(f.previous, '.env.production'), 'CS_READER_PUBLIC_PILOT=1\nCS_CORPUS_INDEX_DB=data/index.sqlite\nCS_CORPUS_INDEX_ARCHIVE_DIR=data\n'); writeFileSync(join(f.candidate, '.env.production'), 'OTHER=value\n'); f.run(); assert.equal(readFileSync(join(f.candidate, 'data/index.sqlite'), 'utf8'), 'immutable-test'); assert.match(readFileSync(join(f.candidate, '.env.production'), 'utf8'), /CS_READER_PUBLIC_PILOT=1/); } finally { f.cleanup(); }
});
test('explicit disabled publication is preserved and requires no copied index', () => { const f = fixture(); try { writeFileSync(join(f.previous, '.env.production'), 'CS_READER_PUBLIC_PILOT=1\nCS_CORPUS_INDEX_DB=data/index.sqlite\n'); writeFileSync(join(f.candidate, '.env.production'), 'CS_READER_PUBLIC_PILOT=0\n'); f.run(); assert.match(readFileSync(join(f.candidate, '.env.production'), 'utf8'), /CS_READER_PUBLIC_PILOT=0/); assert.equal(existsSync(join(f.candidate, 'data/index.sqlite')), false); } finally { f.cleanup(); } });
test('explicit replacement without its artifact stops a release rather than silently falling back', () => { const f = fixture(); try { writeFileSync(join(f.previous, '.env.production'), ''); writeFileSync(join(f.candidate, '.env.production'), 'CS_READER_PUBLIC_PILOT=1\nCS_CORPUS_INDEX_DB=data/new.sqlite\n'); assert.throws(() => f.run()); } finally { f.cleanup(); } });
