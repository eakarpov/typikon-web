import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createPublication, DictionaryPublication } from '@/lib/csDictionary/database';
import { ReaderService } from '../service';
import { ReaderError, PILOT, sha, type Obj } from '../core';
import { profileSets, project } from '../projection';
import { buildIndex, openIndex, configuredIndex, type Review } from './store';
import { CorpusIndexService } from './service';
import { handleIndex } from './http';
import { readerAccess } from './access';
const P = profileSets[0].id, D = 'd'.repeat(64);
const error = (code: string, status: number) => (e: any) => e.code === code && e.status === status;
async function fixture(raw = 'Сло́во сло\uEFFFво жизнь. Сло́во жизнь.', reviewed = false) {
    const dir = mkdtempSync(join(tmpdir(), 'cs-index-test-'));
    const dict = new Database(':memory:'); createPublication(dict);
    for (const [key, value] of Object.entries({ state: 'complete', format: 'cs-publication-v1', scopeChecked: '1', version: D })) dict.prepare('INSERT INTO metadata VALUES(?,?)').run(key, value);
    dict.prepare('INSERT INTO sources VALUES(?,?)').run('s1', JSON.stringify({ id: 's1', title: 'Synthetic dictionary source', text: 'Слово', examples: [] }));
    dict.prepare('INSERT INTO articles VALUES(?,?,?,?)').run('lemma:word', 'слово', 'noun', JSON.stringify({ id: 'lemma:word', name: 'слово', pos: 'noun', extra: [], sources: [{ id: 's1', mappingStatus: 'verified' }] }));
    dict.prepare('INSERT INTO forms VALUES(?,?,?,?,?,?)').run('слово', 'lemma:word', 'слово', '', 'lemma', 0);
    const dictionary = new DictionaryPublication(dict);
    const body = { bodyId: 'body:one', bodyRevision: 'br1_' + sha(raw), raw, chant: true };
    const source = (id: string) => ({ sourceId: id, title: id, sourceRights: { status: 'unresolved', licenseId: null } });
    const unit = (id: string) => ({ occurrenceId: id, bodyId: body.bodyId, bodyRevision: body.bodyRevision, placement: { ode: 1 }, repeatCount: 3 });
    const entry = (id: string, kind: string, units: Obj[]) => ({ sourceId: id, sourceRevision: 'sr:' + id, passportRevision: 'pr:' + id, source: source(id), nativeRef: { kind, id }, units });
    // Two aliases of occurrence:a; a separate real occurrence of the same body remains a separate hit.
    const entries = [entry('P01', 'canon', [unit('occurrence:a'), unit('occurrence:b')]), entry('P04', 'chant', [unit('occurrence:a')])];
    const state = { hidden: new Set<string>(), stale: false };
    const reader = { async release() { return { release: { _id: 'release:test', entries } }; }, async entry(a: Obj) { const e = entries.find(e => e.sourceId === a.sourceId); if (!e || state.hidden.has(a.sourceId)) throw new ReaderError('not_found', 404, 'Hidden'); return { entry: e, descriptor: { units: e.units } }; }, async body() { if (state.stale) throw new ReaderError('revision_unavailable', 410, 'Changed'); return body; } } as unknown as ReaderService;
    const token = project(body, P).tokens.find((t: Obj) => t.lookupKey?.value === 'слово');
    const review: Review = { id: 'review:one', decision: 'accepted', occurrenceId: 'occurrence:a', bodyId: body.bodyId, bodyRevision: body.bodyRevision, tokenIds: [token.tokenId], lexemeId: 'lemma:word', dictionaryVersion: D, sourceId: 'P01', sourceRevision: 'sr:P01', rawRanges: token.rawRanges, quoteSha256: sha(token.rawRanges.map((r: number[]) => raw.slice(r[0], r[1])).join('')), dictionarySourceIds: ['s1'], reviewer: 'test-only', rationale: 'Synthetic explicit contextual acceptance' };
    const built = await buildIndex(reader, { outputDir: dir, dictionary, reviews: reviewed ? [review] : [] });
    const load = (version?: string) => { if (version && version !== built.manifest.indexRevision) throw new ReaderError('index_revision_unavailable', 409, 'Unknown'); return openIndex(built.path); };
    const service = new CorpusIndexService(reader, load);
    return { ...built, service, reader, dictionary, dir, state, review, cleanup() { dict.close(); rmSync(dir, { recursive: true, force: true }); } };
}
const word = (q: string, extra: Obj = {}) => ({ pilotId: PILOT, profileSetId: P, mode: 'word', q, ...extra });
const lemma = (extra: Obj = {}) => ({ pilotId: PILOT, profileSetId: P, lexemeId: 'lemma:word', dictionaryVersion: D, ...extra });
test('materialized keys and candidate links do not copy raw text or allocate placement IDs', async () => {
    const f = await fixture(); try {
        assert.equal(f.manifest.coverage.navigationUnits, 3); assert.equal(f.manifest.coverage.placements, 2); assert.equal(f.manifest.coverage.bodies, 1); assert.equal(f.manifest.coverage.acceptedLinks, 0);
        const index = openIndex(f.path); try { const schema = JSON.stringify(index.db.prepare("SELECT sql FROM sqlite_master WHERE type='table'").all()); assert.doesNotMatch(schema, /raw_text|view_text|surface_text/); assert.ok((index.db.prepare('SELECT count(*) n FROM candidates').get() as Obj).n > 0); } finally { index.db.close(); }
        assert.ok(!readFileSync(f.path).includes(Buffer.from('Сло́во сло\uEFFFво жизнь.')));
        assert.equal((await f.service.occurrences(lemma())).hits.length, 0);
    } finally { f.cleanup(); }
});
test('P01/P04 aliases share hit ID; real placements and repeated words stay distinct', async () => {
    const f = await fixture(); try {
        const result = await f.service.search(word('слово'));
        assert.equal(result.hits.length, 4); assert.equal(new Set(result.hits.map((h: Obj) => h.hitId)).size, 4);
        assert.equal(result.hits[0].address.sourceId, 'P01'); assert.equal(result.hits[0].navigationAliases[0].address.sourceId, 'P04');
        assert.equal(result.hits[0].source.sourceRights.licenseId, null); assert.equal(result.association, 'surface-match-only');
        assert.equal((await f.service.search(word('сло'))).hits.length, 0);
    } finally { f.cleanup(); }
});
test('blocked PUA does not produce cropped keys or allow a phrase to jump it', async () => {
    const f = await fixture(); try {
        const phrase = await f.service.search(word('слово жизнь', { mode: 'phrase' })); assert.equal(phrase.hits.length, 2);
        assert.equal(phrase.hits[0].rawRanges.length, 2); assert.ok(phrase.hits[0].rawRanges[0][0] > 0);
        await assert.rejects(f.service.search(word('сло\uEFFFво')), error('unresolved_query_glyph', 422));
        await assert.rejects(f.service.search(word(' , ')), error('invalid_request', 400));
        await assert.rejects(f.service.search(word('слово', { mode: 'phrase' })), error('invalid_request', 400));
        await assert.rejects(f.service.search(word(Array(14).fill('слово').join(' '), { mode: 'phrase' })), error('invalid_request', 400));
    } finally { f.cleanup(); }
});
test('accepted links require explicit address-specific review and exact D; candidate-only occurrence remains absent', async () => {
    const f = await fixture(undefined, true); try {
        const result = await f.service.occurrences(lemma()); assert.equal(result.hits.length, 1); assert.equal(result.hits[0].bindingEvidence.id, 'review:one'); assert.equal(result.hits[0].matchKind, 'lexeme_verified');
        const surface = await f.service.search(word('слово')); assert.equal(result.hits[0].hitId, surface.hits[0].hitId);
        await assert.rejects(f.service.occurrences(lemma({ dictionaryVersion: 'e'.repeat(64) })), error('dictionary_version_mismatch', 409));
        await assert.rejects(f.service.occurrences(lemma({ dictionaryVersion: undefined })), error('invalid_request', 400));
    } finally { f.cleanup(); }
});
test('review evidence and overlapping acceptance are validated against raw and dictionary sources', async () => {
    const f = await fixture(); try {
        await assert.rejects(buildIndex(f.reader, { outputDir: f.dir, dictionary: f.dictionary, reviews: [{ ...f.review, quoteSha256: 'wrong' }] }), /Review evidence mismatch/);
        await assert.rejects(buildIndex(f.reader, { outputDir: f.dir, dictionary: f.dictionary, reviews: [f.review, { ...f.review, id: 'second' }] }), /Conflicting accepted/);
    } finally { f.cleanup(); }
});
test('cursor binds I/C/D/P/query/limit and visibility, without latest fallback', async () => {
    const f = await fixture(); try {
        const first = await f.service.search(word('слово', { limit: '1' })); assert.ok(first.page.nextCursor);
        const continuation = word('слово', { limit: '1', indexRevision: first.indexRevision, cursor: first.page.nextCursor });
        const next = await f.service.search(continuation); assert.notEqual(next.hits[0].hitId, first.hits[0].hitId);
        await assert.rejects(f.service.search({ ...continuation, q: 'жизнь' }), error('cursor_mismatch', 409));
        await assert.rejects(f.service.search({ ...continuation, limit: '2' }), error('cursor_mismatch', 409));
        await assert.rejects(f.service.search({ ...continuation, profileSetId: profileSets[1].id }), error('cursor_mismatch', 409));
        await assert.rejects(f.service.search({ ...continuation, cursor: '!!!' }), error('invalid_request', 400));
        await assert.rejects(f.service.search({ ...continuation, indexRevision: 'ix1_' + 'f'.repeat(64) }), error('index_revision_unavailable', 409));
        f.state.hidden.add('P04'); await assert.rejects(f.service.search(continuation), error('cursor_mismatch', 409));
        f.state.hidden.add('P01'); assert.equal((await f.service.search(word('слово'))).hits.length, 0); assert.equal((await f.service.capabilities()).coverage?.navigationMaterials, 0);
    } finally { f.cleanup(); }
});
test('edited raw returns stale, unknown profiles fail, retained snapshots do not retokenize new bytes', async () => {
    const f = await fixture(); try {
        await assert.rejects(f.service.search(word('слово', { profileSetId: profileSets[2].id })), error('unsupported_profile', 422));
        await assert.rejects(f.service.search(word('слово', { profileSetId: 'unknown' })), error('unsupported_profile', 422));
        f.state.stale = true; await assert.rejects(f.service.search(word('слово')), error('index_stale', 409));
    } finally { f.cleanup(); }
});
test('postings are reused deterministically while D and review manifests remain distinct', async () => {
    const f = await fixture(); try {
        const again = await buildIndex(f.reader, { outputDir: f.dir, dictionary: f.dictionary, reuse: f.path }); assert.equal(again.sha256, f.sha256); assert.equal(again.buildStats.reusedBodies, 1);
        const reviewed = await buildIndex(f.reader, { outputDir: f.dir, dictionary: f.dictionary, reuse: f.path, reviews: [f.review] }); assert.notEqual(reviewed.manifest.indexRevision, f.manifest.indexRevision); assert.equal(reviewed.manifest.tableHashes.tokens, f.manifest.tableHashes.tokens); assert.equal(reviewed.manifest.tableHashes.search_keys, f.manifest.tableHashes.search_keys);
    } finally { f.cleanup(); }
});
test('501st hit proves truncation; pages stop at 500 and never multiply rubric repeatCount', async () => {
    const f = await fixture(Array(260).fill('слово').join(' ')); try {
        let result = await f.service.search(word('слово', { limit: '50' })); let count = result.hits.length;
        assert.deepEqual(result.page.total, { state: 'at_least', value: 501 });
        while (result.page.nextCursor) { result = await f.service.search(word('слово', { limit: '50', indexRevision: result.indexRevision, cursor: result.page.nextCursor })); count += result.hits.length; }
        assert.equal(count, 500); assert.equal(result.page.truncated, true); assert.equal(result.page.hasMore, true);
    } finally { f.cleanup(); }
});
test('snippet preserves whole match; a normalized short key with oversized raw match returns explicit null', async () => {
    const f = await fixture('слово ' + 'а' + '\u0301'.repeat(600) + ' жизнь'); try {
        const short = await f.service.search(word('слово')); assert.ok(short.hits[0].snippet.rawText.length <= 512);
        const oversized = await f.service.search(word('а')); assert.equal(oversized.hits.length, 2); assert.equal(oversized.hits[0].snippet, null); assert.equal(oversized.hits[0].snippetStatus, 'match_exceeds_budget');
        await assert.rejects(f.service.search(word('а'.repeat(201))), error('invalid_request', 400));
    } finally { f.cleanup(); }
});
test('public HTTP needs no key, ignores spoofed site privilege and has proper envelope/cache/ETag', async () => {
    const old = process.env.CS_READER_PUBLIC_PILOT; process.env.CS_READER_PUBLIC_PILOT = '1'; const f = await fixture();
    try {
        const base = 'https://www.typikon.info/api/v2/study/reader/v1/index/';
        const response = await handleIndex(new Request(base + 'search?' + new URLSearchParams(word('слово')), { headers: { 'x-real-ip': 'test-http' } }), 'search', f.service);
        assert.equal(response.status, 200); assert.equal((await response.json()).contract, 'cs-index/1'); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.ok(response.headers.has('x-ratelimit-limit'));
        const caps = await handleIndex(new Request(base + 'capabilities', { headers: { 'x-real-ip': 'test-http' } }), 'capabilities', f.service); assert.equal(caps.status, 200);
        assert.equal((await handleIndex(new Request(base + 'capabilities', { headers: { 'x-real-ip': 'test-http', 'if-none-match': caps.headers.get('etag')! } }), 'capabilities', f.service)).status, 304);
    } finally { if (old === undefined) delete process.env.CS_READER_PUBLIC_PILOT; else process.env.CS_READER_PUBLIC_PILOT = old; f.cleanup(); }
});
test('public budgets apply across search/occurrences and trusted IP; OPTIONS consumes no budget', async () => {
    const old = process.env.CS_READER_PUBLIC_PILOT; process.env.CS_READER_PUBLIC_PILOT = '1';
    try {
        for (let i = 0; i < 35; i++) assert.equal((await handleIndex(new Request('https://test/index/search', { method: 'OPTIONS', headers: { 'x-real-ip': 'test-budget' } }), 'search')).status, 204);
        for (let i = 0; i < 30; i++) assert.equal((await readerAccess(new Request('https://test/', { headers: { 'x-real-ip': 'test-budget', 'origin': 'https://www.typikon.info' } }), i % 2 ? 'search' : 'occurrences')).denied, null);
        const denied = await readerAccess(new Request('https://test/', { headers: { 'x-real-ip': 'test-budget', 'referer': 'https://www.typikon.info/' } }), 'search'); assert.equal(denied.denied?.status, 429); assert.ok(Number(denied.headers['Retry-After']) > 0);
        for (let i = 0; i < 120; i++) assert.equal((await readerAccess(new Request('https://test/', { headers: { 'x-forwarded-for': 'spoof-' + i + ', test-aggregate' } }), 'capabilities')).denied, null);
        assert.equal((await readerAccess(new Request('https://test/', { headers: { 'x-forwarded-for': 'new-spoof, test-aggregate' } }), 'capabilities')).denied?.status, 429);
    } finally { if (old === undefined) delete process.env.CS_READER_PUBLIC_PILOT; else process.env.CS_READER_PUBLIC_PILOT = old; }
});
test('D-only publication reuses postings but changes manifest and candidate provenance', async () => {
    const f = await fixture(); try {
        f.dictionary.db.prepare("UPDATE metadata SET value=? WHERE key='version'").run('e'.repeat(64));
        const dictionary = new DictionaryPublication(f.dictionary.db);
        const next = await buildIndex(f.reader, { outputDir: f.dir, dictionary, reuse: f.path });
        assert.equal(next.buildStats.reusedBodies, 1); assert.notEqual(next.manifest.indexRevision, f.manifest.indexRevision);
        assert.equal(next.manifest.tableHashes.tokens, f.manifest.tableHashes.tokens); assert.equal(next.manifest.tableHashes.search_keys, f.manifest.tableHashes.search_keys);
        assert.notEqual(next.manifest.tableHashes.candidates, f.manifest.tableHashes.candidates); assert.equal(next.manifest.dictionaryVersion, 'e'.repeat(64));
        await assert.rejects(buildIndex(f.reader, { outputDir: f.dir, dictionary, reviews: [f.review] }), /Unbound or incomplete review/);
    } finally { f.cleanup(); }
});
test('minimal response above byte budget is 413; immutable profile fingerprint mismatch is 409', async () => {
    const f = await fixture(); try {
        const release = await f.reader.release(); release.release.entries[0].source.title = 'я'.repeat(550000);
        const big = await buildIndex(f.reader, { outputDir: f.dir, dictionary: f.dictionary });
        const service = new CorpusIndexService(f.reader, () => openIndex(big.path));
        await assert.rejects(service.search(word('слово')), error('response_too_large', 413));
        const incompatible = new CorpusIndexService(f.reader, () => { const index = openIndex(f.path); index.manifest.profileFingerprints[0].fingerprint = 'changed'; return index; });
        await assert.rejects(incompatible.search(word('слово')), error('index_incompatible', 409));
    } finally { f.cleanup(); }
});
test('approved dictionary source-variant stays a candidate, not an accepted corpus link', async () => {
    const f = await fixture(); try {
        f.dictionary.db.prepare("UPDATE forms SET origin='source-variant'").run();
        const candidate = await buildIndex(f.reader, { outputDir: f.dir, dictionary: f.dictionary, reuse: f.path });
        const index = openIndex(candidate.path); try {
            const c = JSON.parse((index.db.prepare('SELECT payload FROM candidates LIMIT 1').get() as Obj).payload);
            assert.equal(c.basis, 'source-variant'); assert.equal(c.reviewStatus, 'unreviewed'); assert.equal(candidate.manifest.coverage.acceptedLinks, 0);
        } finally { index.db.close(); }
    } finally { f.cleanup(); }
});
test('unpublished capability is explicit and does not require opening native bodies', async () => {
    const saved = process.env.CS_CORPUS_INDEX_DB; delete process.env.CS_CORPUS_INDEX_DB;
    try { assert.equal((await new CorpusIndexService({} as ReaderService).capabilities()).available, false); }
    finally { if (saved !== undefined) process.env.CS_CORPUS_INDEX_DB = saved; }
});

test('retained I selects its own artifact; unknown I never falls back and explicit retirement returns 410', async () => {
    const f = await fixture(); const saved = process.env.CS_CORPUS_INDEX_DB, archive = process.env.CS_CORPUS_INDEX_ARCHIVE_DIR;
    try {
        const next = await buildIndex(f.reader, { outputDir: f.dir, dictionary: f.dictionary, reviews: [f.review] });
        process.env.CS_CORPUS_INDEX_DB = next.path; process.env.CS_CORPUS_INDEX_ARCHIVE_DIR = f.dir;
        const old = configuredIndex(f.manifest.indexRevision); assert.equal(old.manifest.coverage.acceptedLinks, 0); old.db.close();
        assert.throws(() => configuredIndex('ix1_' + 'f'.repeat(64)), error('index_revision_unavailable', 409));
        writeFileSync(join(f.dir, 'retired-' + f.manifest.indexRevision + '.json'), '{}');
        assert.throws(() => configuredIndex(f.manifest.indexRevision), error('index_retired', 410));
        writeFileSync(join(f.dir, 'retired-' + next.manifest.indexRevision + '.json'), '{}');
        assert.throws(() => configuredIndex(), error('index_retired', 410));
    } finally { if (saved === undefined) delete process.env.CS_CORPUS_INDEX_DB; else process.env.CS_CORPUS_INDEX_DB = saved; if (archive === undefined) delete process.env.CS_CORPUS_INDEX_ARCHIVE_DIR; else process.env.CS_CORPUS_INDEX_ARCHIVE_DIR = archive; f.cleanup(); }
});
