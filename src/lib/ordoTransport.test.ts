import { AsyncLocalStorage } from 'node:async_hooks';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createOrdoTransport } from './ordoTransport';
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
test('mixed calendar and package burst obeys the real two-slot upstream, reading bypasses calendar backlog', async () => {
    let active = 0, peak = 0, busy = 0, background = 0, peakBackground = 0;
    const finished: string[] = [];
    const server = createServer(async (req, res) => {
        active++; peak = Math.max(peak, active);
        const bulk = req.url!.startsWith('/day');
        if (bulk) { background++; peakBackground = Math.max(peakBackground, background); }
        if (active > 2) { busy++; res.writeHead(503, {'Retry-After':'0'}); res.end('busy'); }
        else { await pause(20); res.writeHead(200, {'X-Ordo-Version':'test'}); res.end(req.url); }
        finished.push(req.url!); active--; if (bulk) background--;
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as any).port, root = `http://127.0.0.1:${port}`;
    const transport = createOrdoTransport({cacheMs:0});
    try {
        const calendar = Array.from({length:40}, (_, i) => transport.fetch(`${root}/day?i=${i}`, 5000, 'background'));
        await pause(5);
        const reading = Array.from({length:12}, (_, i) => transport.fetch(`${root}/package?i=${i}`, 5000));
        const results = await Promise.all([...calendar, ...reading]);
        assert.ok(results.every(r => r.status === 200));
        assert.equal(busy, 0); assert.equal(peak, 2); assert.equal(peakBackground, 1);
        assert.ok(finished.findIndex(s => s.startsWith('/package')) < 2);
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('in-flight callers receive separate consumable bodies; short cache keeps rights and query parameters isolated', async () => {
    let calls = 0;
    const transport = createOrdoTransport({fetch: async input => {
        calls++; await pause(5);
        return new Response(String(input), {headers:{'X-Ordo-Version':'same'}});
    }});
    const readers = await Promise.all(Array.from({length:30}, () => transport.fetch('http://engine/package?date=2026-11-15&bodies=free')));
    assert.equal(calls, 1);
    assert.ok((await Promise.all(readers.map(r => r.text()))).every(s => s.includes('bodies=free')));
    assert.equal(readers[0].headers.get('x-ordo-version'), 'same');
    await transport.fetch('http://engine/package?bodies=free&date=2026-11-15'); assert.equal(calls, 1);
    const internal = await transport.fetch('http://engine/package?date=2026-11-15&bodies=internal');
    assert.ok((await internal.text()).includes('internal')); assert.equal(calls, 2);
    await transport.fetch('http://engine/package?date=2026-11-16&bodies=free'); assert.equal(calls, 3);
});
test('busy recovery is bounded, errors are not cached, 404 is not retried', async () => {
    let calls = 0;
    const transport = createOrdoTransport({fetch: async () => ++calls < 3
        ? Response.json({code:'busy'}, {status:503,headers:{'Retry-After':'0'}})
        : Response.json({ok:true})});
    assert.equal((await transport.fetch('http://busy/day')).status, 200); assert.equal(calls, 3);
    let errors = 0;
    const failures = createOrdoTransport({fetch: async () => { errors++; return new Response('missing', {status:404}); }});
    assert.equal((await failures.fetch('http://missing/day')).status, 404);
    assert.equal((await failures.fetch('http://missing/day')).status, 404); assert.equal(errors, 2);
    let busy = 0;
    const saturated = createOrdoTransport({fetch: async () => { busy++; return new Response('busy', {status:503,headers:{'Retry-After':'0'}}); }});
    assert.equal((await saturated.fetch('http://saturated/day')).status, 503); assert.equal(busy, 4);
    await saturated.fetch('http://saturated/day'); assert.equal(busy, 8);
});
test('a queued timeout removes the request without calling upstream or leaking capacity', async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => release = resolve);
    const transport = createOrdoTransport({cacheMs:0,fetch: async () => { calls++; await gate; return new Response('ok'); }});
    const first = transport.fetch('http://engine/day?i=1', 2000, 'background');
    await assert.rejects(transport.fetch('http://engine/day?i=2', 15, 'background'), {name:'TimeoutError'});
    assert.equal(calls, 1); assert.equal(transport.stats().waiting, 0);
    release(); await first; await pause(0);
    assert.equal(transport.stats().active, 0); assert.equal(transport.stats().flights, 0);
});
test('queue budget and retained response bytes are bounded', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => release = resolve);
    const transport = createOrdoTransport({maxWaiting:1,cacheBytes:600,fetch: async () => { await gate; return new Response('x'.repeat(1024)); }});
    const first = transport.fetch('http://engine/a', 2000, 'background');
    const next = transport.fetch('http://engine/b', 2000, 'background');
    await assert.rejects(transport.fetch('http://engine/c', 2000, 'background'), /переполнена/);
    release(); await Promise.all([first,next]); await pause(0);
    assert.equal(transport.stats().retained, 0);
});
test('a foreground reader promotes an identical queued calendar request', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => release = resolve);
    const seen: string[] = [];
    const transport = createOrdoTransport({cacheMs:0,fetch: async input => { seen.push(String(input)); if (String(input).endsWith('/first')) await gate; return new Response('ok'); }});
    const first = transport.fetch('http://engine/first', 2000, 'background');
    const queued = transport.fetch('http://engine/next', 2000, 'background');
    const reader = transport.fetch('http://engine/next', 2000, 'interactive');
    await reader; assert.equal(seen.length, 2);
    release(); await Promise.all([first, queued]);
});
test('headers alone do not release an upstream slot while its body is streaming', async () => {
    let active = 0, peak = 0;
    const server = createServer(async (_req,res) => {
        active++; peak = Math.max(peak, active);
        res.writeHead(200); res.flushHeaders(); await pause(25); res.end('complete'); active--;
    });
    await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
    const root = `http://127.0.0.1:${(server.address() as any).port}`;
    try {
        const transport = createOrdoTransport({cacheMs:0});
        const bodies = await Promise.all(Array.from({length:10},(_,i) => transport.fetch(root+'/?id='+i,2000).then(r=>r.text())));
        assert.ok(bodies.every(body => body === 'complete')); assert.equal(peak,2);
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(()=>resolve())); }
});
test('connection reset retries once and cache memory stays bounded across distinct requests', async () => {
    let calls = 0;
    const reconnect = createOrdoTransport({fetch:async()=>{ if (++calls===1) throw TypeError('connection reset'); return new Response('restored'); }});
    assert.equal(await (await reconnect.fetch('http://reset/day')).text(),'restored'); assert.equal(calls,2);
    let reads=0;
    const bounded=createOrdoTransport({cacheBytes:4096,fetch:async()=>{reads++;return new Response('x'.repeat(200));}});
    for(let i=0;i<30;i++)await bounded.fetch('http://many/day?date='+i);
    assert.ok(bounded.stats().retained<=4096);
    await bounded.fetch('http://many/day?date=0');assert.equal(reads,31);
});

test('queued fetch preserves the submitting Next request async context', async () => {
    const context = new AsyncLocalStorage<string>();
    const transport = createOrdoTransport({cacheMs:0,fetch:async()=>{
        const request=context.getStore();await pause(5);return new Response(request);
    }});
    const requests=['one','two','three','four','five','six'].map(id=>context.run(id,()=>transport.fetch('http://context/'+id).then(r=>r.text())));
    assert.deepEqual(await Promise.all(requests),['one','two','three','four','five','six']);
});
