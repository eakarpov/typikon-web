import '@/scripts/lib/env';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { ReaderService } from '@/lib/reader/service';
import { readerDb, publishPilot } from '@/lib/reader/registry';
import { validate, envelope, PILOT, ReaderError, sha } from '@/lib/reader/core';
import { profileSets } from '@/lib/reader/projection';
import { handle } from '@/lib/reader/http';
import { readerPage } from '@/lib/reader/page';
import { openapi } from '@/lib/api/v2/openapi';
async function main() {
    const uri=process.env.MONGODB_URI??'';
    if(!['localhost','127.0.0.1','[::1]'].includes(new URL(uri).hostname))throw Error('Verification republishes locally; remote MongoDB is not allowed.');
    const service = new ReaderService(await readerDb()); const report: any = { checks: [], materials: [], fullBodiesStored: false };
    const check = (schema: string, data: any) => { try { validate(schema, envelope(data)); } catch (e) { console.error(schema, JSON.stringify((e as ReaderError).details)); throw e; } };
    check('CapabilitiesResponse', service.capabilities()); const catalog = await service.catalog({ pilotId: PILOT }); check('CatalogResponse', catalog); assert.equal(catalog.items.length, 5);
    for (const item of catalog.items) {
        const resolved: any = await service.resolve({ contract: 'cs-reader/1', url: item.canonicalUrl }); check('ResolveResponse', resolved); const passport = await service.passport(item.sourceId); check('PassportResponse', passport);
        let total = 0; for (const ps of profileSets) { let cursor: string | undefined; do { const page = await service.read({ contract: 'cs-reader/1', address: resolved.resolvedAddress, profileSetId: ps.id, limit: 20, ...(cursor ? { cursor } : {}) }); check('ReadResponse', page); if (ps === profileSets[0]) total += page.units.length; cursor = page.page.nextCursor ?? undefined; } while (cursor); }
        const html = await readerPage(new Request(item.canonicalUrl)); assert.equal(html.status, 200); assert.match(html.headers.get('x-robots-tag') ?? '', /noindex/);
        report.materials.push({ sourceId: item.sourceId, title: item.title, units: total, htmlStatus: html.status });
    }
    const chapter = catalog.items.find(i => i.kind === 'text')!; const read = await service.read({ contract: 'cs-reader/1', address: { version: 2, sourceId: chapter.sourceId }, profileSetId: profileSets[0].id }); assert.equal(sha(read.projections[0].rawText), '9b908856543a0c9930d633d2c5f57337151fd38d19c29fca9b7a65224612896f');
    const legacy:any=await service.resolve({contract:'cs-reader/1',url:'https://www.typikon.info/reading/id/699c9ace0c51f1c698ea0492?revision='+read.snapshot.sourceRevision});assert.equal(legacy.resolvedAddress.sourceRevision,read.snapshot.sourceRevision);
    const word = read.projections[0].tokens.find((t: any) => t.lookupKey); const lookup = await service.lookup({ contract: 'cs-reader/1', address: read.resolvedAddress, profileSetId: profileSets[0].id, tokens: [{ bodyId: word.bodyId, bodyRevision: word.bodyRevision, tokenId: word.tokenId, tokenizerProfileId: word.tokenizerProfileId, rawRanges: word.rawRanges }] }); check('LookupResponse', lookup);
    const searched = await service.search({ pilotId: PILOT, q: 'Христос', profileSetId: profileSets[0].id, limit: 2 }); check('SearchResponse', searched); assert.ok(searched.hits.length); for (const hit of searched.hits) assert.ok(hit.snippet.rawWindow[1] - hit.snippet.rawWindow[0] < 1000);
    const canon = catalog.items.find(i => i.kind === 'canon')!, irmos = catalog.items.find(i => i.canonicalUrl !== canon.canonicalUrl && i.title.includes('ирмос')) ?? catalog.items[3];
    const cr = await service.read({ contract: 'cs-reader/1', address: { version: 2, sourceId: canon.sourceId }, profileSetId: profileSets[0].id }); const ir = await service.read({ contract: 'cs-reader/1', address: { version: 2, sourceId: irmos.sourceId }, profileSetId: profileSets[0].id }); assert.ok(cr.sourceDescriptor.units.some((u: any) => u.occurrenceId === ir.units[0].occurrenceId && u.bodyId === ir.units[0].bodyRef.bodyId));
    await assert.rejects(service.read({ contract: 'cs-reader/1', address: read.resolvedAddress, profileSetId: 'unknown' }), (e: any) => e.code === 'unsupported_profile');
    const response = await handle(new Request('https://www.typikon.info/api/v2/study/reader/v1/capabilities'), 'capabilities'); assert.equal(response.status, 200); validate('CapabilitiesResponse', await response.json());
    const bad = await handle(new Request('https://www.typikon.info/api/v2/study/reader/v1/read', { method: 'POST', body: JSON.stringify({ contract: 'future' }) }), 'read'); assert.equal(bad.status, 422);
    const etag = await handle(new Request('https://www.typikon.info/api/v2/study/reader/v1/capabilities', { headers: { 'if-none-match': response.headers.get('etag')! } }), 'capabilities'); assert.equal(etag.status, 304);
    const spec: any = openapi(); assert.equal(spec.paths['/api/v2/chants/{id}'].get.deprecated, true); assert.ok(spec.paths['/api/v2/study/reader/v1/read']);
    const state = await service.release(); const before = state.release._id; const again = await publishPilot(service.db, { apply: true, activate: true }); assert.equal(again.releaseId, before);
    report.checks = ['all seven response schemas', 'five sources × three profiles with pagination', 'raw chapter hash including PUA', 'shared canon/irmos body and occurrence', 'reader HTML noindex', 'dictionary lookup', 'bounded search snippets', 'unsupported profile', 'contract error 422', 'ETag 304', 'merged OpenAPI and deprecated legacy', 'legacy URL revision selector', 'idempotent republication']; report.releaseId = before;
    const out = JSON.stringify(report, null, 2); console.log(out); const at = process.argv.indexOf('--report'); if (at >= 0) writeFileSync(process.argv[at + 1], out + '\n');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { const { default: client } = await import('@/lib/mongodb'); await (await client).close(); });
