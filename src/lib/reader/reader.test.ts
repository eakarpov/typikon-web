import test from 'node:test';
import assert from 'node:assert/strict';
import { canonical, sha, validate, envelope, ReaderError } from './core';
import { project, lookupKey, searchKey } from './projection';
import { readerDeprecationHeaders } from './deprecation';
import { continuity } from './legacy';
const body = (raw: string) => ({ raw, bodyId: 'bdy_00000000000040008000000000000001', bodyRevision: 'br1_' + sha(raw) });
const source = 'cs-pilot-source-r1', unicode = 'cs-pilot-unicode-r1';
test('canonical hashing rejects invalid UTF16, floats and preserves original string', () => {
    assert.equal(canonical({ z: 'ѣ́', a: 1 }), '{"a":1,"z":"ѣ́"}');
    assert.throws(() => canonical('\ud800')); assert.throws(() => canonical(1.1)); assert.throws(() => canonical({ a: undefined }));
});
test('projection preserves raw PUA and supplementary offsets; normalized mapping remains reversible by ranges', () => {
    const raw = 'Сло́во \uF074 и ' + String.fromCodePoint(0xf0023) + '\n'; const b = body(raw);
    const p = project(b, source); validate('BodyProjection', p); assert.equal(p.rawText, raw); assert.deepEqual(p.rawWindow, [0, raw.length]);
    const normalized = project(b, unicode); validate('BodyProjection', normalized); assert.equal(normalized.rawText, raw);
    let end = 0; for (const segment of normalized.map.segments) { assert.equal(segment.rawRanges[0][0], end); end = segment.rawRanges.at(-1)![1]; } assert.equal(end, raw.length);
});
test('word and surrogate boundaries cannot be cut; local view offsets retain absolute raw offsets', () => {
    const b = body('Первое слово\nдругое'); assert.throws(() => project(b, source, [1, 5]), ReaderError);
    const full = project(b, source); const token = full.tokens.find((t: any) => t.type === 'word' && t.rawRanges[0][0] > 0);
    const window = project(b, source, token.rawRanges[0]); assert.equal(window.tokens[0].tokenId, token.tokenId); assert.deepEqual(window.tokens[0].surfaceRanges, [[0, 5]]); assert.deepEqual(window.tokens[0].rawRanges, [[7, 12]]);
});
test('lookup keeps abbreviated spelling and blocks unknown PUA', () => {
    assert.equal(lookupKey('Сло́во'), 'слово'); assert.equal(lookupKey('бг҃'), 'бг҃'); assert.equal(lookupKey('сло\uEFFFво'), null); assert.notEqual(searchKey('й'), searchKey('и'));
    const p = project(body('сло\uEFFFво'), source); assert.equal(p.tokens[0].lookupKey, null); assert.ok(p.tokens[0].flags.includes('unresolved_glyph'));
});
test('markdown display hides syntax but rawText and offsets retain it', () => {
    const p = project(body('**Слово** и [текст](/reading/a)'), source); validate('BodyProjection', p); assert.equal(p.viewText, 'Слово и текст'); assert.equal(p.rawText, '**Слово** и [текст](/reading/a)');
});
test('legacy deprecation covers parameter paths and leaves dictionary API current', () => {
    assert.ok(readerDeprecationHeaders('/api/v2/chants/132').Deprecation); assert.ok(readerDeprecationHeaders('/api/v2/study/material').Deprecation); assert.deepEqual(readerDeprecationHeaders('/api/v2/cs-dictionary/search'), {}); assert.equal(readerDeprecationHeaders('/api/v2/chants/132').Sunset, undefined);
});
test('rebuild rematches identity evidence; repeated native number alone cannot prove continuity', () => {
    const old = [{ publicId: 132, signature: 'original' }]; assert.equal(continuity(old, 'original', new Set()), 132); assert.equal(continuity(old, 'other', new Set()), null); assert.equal(continuity([...old, { publicId: 133, signature: 'original' }], 'original', new Set()), null); assert.equal(continuity(old, 'original', new Set([132])), null);
});

test("Markdown soft linebreaks preserve trailing source spaces without coarse token ranges", () => { const raw = "Первое \nслово \nдругое"; const p = project(body(raw), source); assert.equal(p.viewText, raw); assert.equal(p.tokens.filter((t: any) => t.type === "word").length, 3); assert.ok(p.tokens.some((t: any) => t.lookupKey?.value === "слово")); });


test('pinned Mongo bodies fail closed after edit or concealment', async () => {
    const { loadBody } = await import('./native');
    let text: any = { content: 'старый текст', readiness: 'texted', public: true };
    const db: any = { collection: () => ({ findOne: async () => text }) };
    const binding = { nativeRef: { namespace: 'typikon.texts', id: '699c9ace0c51f1c698ea0492' }, bodyRevision: 'br1_' + sha(text.content) };
    assert.equal(await loadBody(db, binding), 'старый текст'); text.content = 'новый текст';
    await assert.rejects(loadBody(db, binding), (e: any) => e.code === 'revision_unavailable' && e.status === 410);
    text.public = false; await assert.rejects(loadBody(db, binding), (e: any) => e.code === 'not_found' && e.status === 404);
});
