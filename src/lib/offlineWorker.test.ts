import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function worker(failAsset = false) {
    const maps = new Map<string, Map<string, Response>>();
    const origin = 'https://example.test';
    const key = (x: any) => new URL(typeof x === 'string' ? x : x.url, origin).href;
    const context = vm.createContext({ URL, Response, Request: class extends Request {
            constructor(x: any, options: any) { super(key(x), options); }
        }, Set, Promise, Date, Error, self: { location: { origin }, addEventListener() { } }, caches: { open: async (name: string) => { if (!maps.has(name))
                maps.set(name, new Map()); const map = maps.get(name)!; return { match: async (x: any) => map.get(key(x))?.clone(), put: async (x: any, r: Response) => map.set(key(x), r.clone()), delete: async (x: any) => map.delete(key(x)) }; } }, fetch: async (x: any) => { const url = key(x); if (url.endsWith('.js'))
            return new Response('js', { status: failAsset ? 503 : 200 }); return new Response('<script src="/_next/static/chunk.js"></script><p>Чтение</p>'); } });
    vm.runInContext(readFileSync('public/sw.js', 'utf8'), context);
    return (s: string) => vm.runInContext(s, context);
}
test('overlapping packages and standalone saves survive deleting another package', async () => { const run = worker(); await run('savePage("/calculator/2026-05-31","День",[],"week:1")'); await run('savePage("/calculator/2026-05-31","День",[],"trip:1")'); await run('forgetGroup("week:1")'); let rows = await run('readIndex()'); assert.equal(rows.length, 1); assert.deepEqual([...rows[0].groups], ['trip:1']); await run('savePage("/calculator/2026-05-31","День",[])'); await run('forgetGroup("trip:1")'); rows = await run('readIndex()'); assert.equal(rows.length, 1); assert.equal(rows[0].standalone, true); });
test('missing script prevents claiming a complete saved page', async () => { const run = worker(true); await assert.rejects(run('savePage("/calculator/2026-05-31","День",[],"week:1")')); assert.equal((await run('readIndex()')).length, 0); });
test('private and cross-origin pages cannot be saved by message', async () => { const run = worker(); await assert.rejects(run('savePage("/reading-plan","Личное",[])')); await assert.rejects(run('savePage("https://other.test/page","Внешнее",[])')); });
