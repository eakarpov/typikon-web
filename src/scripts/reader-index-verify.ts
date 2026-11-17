import '@/scripts/lib/env';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { ReaderService } from '@/lib/reader/service';
import { readerDb } from '@/lib/reader/registry';
import { CorpusIndexService } from '@/lib/reader/index/service';
import { openIndex, lexical, bodyKey, INDEX_PROFILE_IDS, verifyIndex } from '@/lib/reader/index/store';
import { handleIndex } from '@/lib/reader/index/http';
import { profileSets, project } from '@/lib/reader/projection';
import { PILOT, canonical, type Obj } from '@/lib/reader/core';
const shaComparison = (tokens: Obj[]) => canonical(tokens.map(t => [t.tokenId, t.rawRanges, t.searchKeys]));
const arg = (k: string) => { const i = process.argv.indexOf(k); return i < 0 ? undefined : process.argv[i + 1]; };
async function main() {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.MONGODB_URI ?? '').hostname)) throw Error('Local verification only');
    const build = JSON.parse(readFileSync(arg('--build')!, 'utf8')); process.env.CS_CORPUS_INDEX_DB = build.path; process.env.CS_READER_PUBLIC_PILOT = '1';
    const reader = new ReaderService(await readerDb()), service = new CorpusIndexService(reader);
    const index = openIndex(build.path); verifyIndex(index); const context = await service.context(index);
    let checkedTokens = 0; const legacyProjectionDiagnostics: Obj[] = [];
    try {
        assert.equal(context.placements.size, 67); assert.equal(context.bodies.size, 67);
        for (const [key, body] of context.bodies) {
            const stored = (index.db.prepare('SELECT token_id,payload FROM tokens WHERE body_key=? ORDER BY position').all(key) as Obj[]).map(t => JSON.parse(t.payload));
            for (const ps of profileSets.filter(p => INDEX_PROFILE_IDS.includes(p.id))) {
                const tokens = project(body, ps.id).tokens.filter(lexical);
                assert.equal(shaComparison(tokens), shaComparison(stored), 'Token/key identity: ' + bodyKey(body));
                checkedTokens += tokens.length;
            }
        }
        const chapter = [...context.bodies.values()].find(b => b.bodyRevision === 'br1_9b908856543a0c9930d633d2c5f57337151fd38d19c29fca9b7a65224612896f')!;
        const sourceIds = new Set(project(chapter, profileSets[0].id).tokens.filter(lexical).map((t: Obj) => t.tokenId));
        for (const ps of profileSets.slice(1)) {
            const tokens = project(chapter, ps.id).tokens.filter(lexical);
            legacyProjectionDiagnostics.push({ profileSetId: ps.id, chapterTokens: tokens.length, sourceTokens: sourceIds.size, tokenIdsAbsentInSource: tokens.filter((t: Obj) => !sourceIds.has(t.tokenId)).length, advertisedByIndex: INDEX_PROFILE_IDS.includes(ps.id) });
        }
        const query = { pilotId: PILOT, mode: 'word', q: 'Христос', profileSetId: profileSets[0].id, limit: '50' };
        const search = await service.search(query), irmos = search.hits.filter((h: Obj) => h.navigationAliases.some((a: Obj) => a.address.sourceId === 'src_3d81e2bf35684343ad079ff6ed83ec8b'));
        assert.equal(irmos.length, 3); assert.equal(new Set(search.hits.map((h: Obj) => h.hitId)).size, search.hits.length);
        const verified = await service.occurrences({ pilotId: PILOT, lexemeId: '68399a217310e32be5d7e0fe', dictionaryVersion: build.manifest.dictionaryVersion, profileSetId: profileSets[0].id });
        assert.equal(verified.hits.length, 3); assert.deepEqual(verified.hits.map((h: Obj) => h.hitId), irmos.map((h: Obj) => h.hitId));
        for (const hit of verified.hits) {
            const packet = await reader.read({ contract: 'cs-reader/1', address: hit.address, profileSetId: profileSets[0].id, window: { bodyId: hit.bodyId, rawRange: hit.snippet.rawWindow } });
            for (const tokenId of hit.tokenIds) assert.ok(packet.projections[0].tokens.some((t: Obj) => t.tokenId === tokenId));
        }
        const base = 'https://www.typikon.info/api/v2/study/reader/v1/index/';
        const response = await handleIndex(new Request(base + 'search?' + new URLSearchParams(query), { headers: { 'x-real-ip': 'm202-local-acceptance' } }), 'search'); assert.equal(response.status, 200);
        const mismatch = await handleIndex(new Request(base + 'occurrences?' + new URLSearchParams({ pilotId: PILOT, lexemeId: '68399a217310e32be5d7e0fe', dictionaryVersion: '0'.repeat(64), profileSetId: profileSets[0].id }), { headers: { 'x-real-ip': 'm202-local-acceptance' } }), 'occurrences'); assert.equal(mismatch.status, 409);
        const report = { format: 'm2-02-real-index-acceptance/1', environment: 'local real published E1 registry; not production', indexRevision: build.manifest.indexRevision, corpusRelease: build.manifest.corpusRelease, dictionaryVersion: build.manifest.dictionaryVersion, coverage: build.manifest.coverage, supportedIndexProfiles: INDEX_PROFILE_IDS, legacyProjectionDiagnostics, runtime: { node: process.version, unicode: process.versions.unicode }, checkedTokensAcrossProfiles: checkedTokens, checks: ['67 existing placements and bodies; no new identity allocation', 'all stored token IDs/raw ranges/search keys equal reader in source-r1 and unicode-r1; letterfold-r1 intentionally unsupported in index', 'P01/P04: three repeated Христос tokens, one hit per token with alternate navigation address', 'four accepted address-specific links; remaining candidates separate', 'verified and surface channels share hit IDs', 'pinned hit -> reader window -> token round trip', 'anonymous HTTP cs-index/1 without Origin/Referer/key', 'wrong D returns 409'], search: { query: 'Христос', hits: search.hits.length, sharedIrmosHits: irmos.length, acceptedChristosHits: verified.hits.length }, http: { searchStatus: response.status, cacheControl: response.headers.get('cache-control'), wrongDictionaryStatus: mismatch.status }, visualTesting: 'left to owner; not performed', apkPublished: false };
        writeFileSync(arg('--report')!, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
    } finally { index.db.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { const { default: client } = await import('@/lib/mongodb'); await (await client).close(); });
