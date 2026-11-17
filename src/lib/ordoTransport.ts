import { AsyncResource } from 'node:async_hooks';
/** One process-wide admission queue for EVERY calendar/reading engine caller.
 * A per-module semaphore is insufficient in Next's separate route bundles.
 * Bulk calendar work uses one of the engine's two slots; reading can use both.
 * Responses are buffered before releasing a slot and cloned for each consumer.
 */
export type OrdoPriority = 'interactive' | 'background';
type Snapshot = { bytes: Uint8Array; status: number; statusText: string; headers: [string, string][] };
type Job = { key: string; url: string; deadline: number; priority: OrdoPriority;
    context: AsyncResource; work: Promise<Snapshot>; resolve: (value: Snapshot) => void; reject: (error: unknown) => void;
    timer: ReturnType<typeof setTimeout> };
export class OrdoTransportTimeout extends Error {
    constructor() { super('Истекло время ожидания сборщика последований'); this.name = 'TimeoutError'; }
}
export function createOrdoTransport(options: {
    fetch?: typeof fetch; cacheBytes?: number; cacheMs?: number; maxWaiting?: number;
} = {}) {
    const perform = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
    const maxBytes = options.cacheBytes ?? 16 * 1024 * 1024, ttl = options.cacheMs ?? 1000;
    const maxWaiting = options.maxWaiting ?? 256;
    const waiting: Job[] = [], flights = new Map<string, Job>();
    const cache = new Map<string, { value: Snapshot; expires: number; size: number }>();
    let active = 0, background = 0, retained = 0;
    const prune = () => {
        for (const [key, entry] of cache) if (entry.expires <= Date.now()) {
            cache.delete(key); retained -= entry.size;
        }
    };
    const remember = (key: string, value: Snapshot) => {
        prune();
        if (value.status !== 200 || value.bytes.byteLength > maxBytes || ttl <= 0) return;
        const size = value.bytes.byteLength + key.length * 2 + 512;
        if (size > maxBytes) return;
        const old = cache.get(key); if (old) retained -= old.size;
        cache.delete(key); cache.set(key, { value, expires: Date.now() + ttl, size }); retained += size;
        while (retained > maxBytes || cache.size > 128) {
            const first = cache.entries().next().value!;
            cache.delete(first[0]); retained -= first[1].size;
        }
    };
    const receive = async (job: Job): Promise<Snapshot> => {
        let networkRetries = 0, busyRetries = 0;
        while (true) {
            const remaining = job.deadline - Date.now();
            if (remaining <= 0) throw new OrdoTransportTimeout();
            try {
                const response = await perform(job.url, { cache: 'no-store', signal: AbortSignal.timeout(remaining) });
                if (response.status === 503 && busyRetries < 3) {
                    const raw = response.headers.get('retry-after');
                    const seconds = Number(raw ?? 2);
                    const delay = Number.isFinite(seconds) ? Math.min(2000, Math.max(0, seconds * 1000)) : 2000;
                    if (job.deadline - Date.now() > delay) {
                        await response.body?.cancel(); busyRetries++;
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                }
                // Keep admission until the whole body is received (not just headers).
                const bytes = new Uint8Array(await response.arrayBuffer());
                return { bytes, status: response.status, statusText: response.statusText,
                    headers: Array.from(response.headers.entries()) };
            } catch (error) {
                const timedOut = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
                if (timedOut || networkRetries++ >= 1 || Date.now() >= job.deadline) throw error;
            }
        }
    };
    const pump = () => {
        while (active < 2) {
            let index = waiting.findIndex(job => job.priority === 'interactive');
            if (index < 0 && background < 1) index = waiting.findIndex(job => job.priority === 'background');
            if (index < 0) return;
            const job = waiting.splice(index, 1)[0]; clearTimeout(job.timer);
            if (job.deadline <= Date.now()) { flights.delete(job.key); job.context.emitDestroy(); job.reject(new OrdoTransportTimeout()); continue; }
            active++; const isBackground = job.priority === 'background'; if (isBackground) background++;
            void job.context.runInAsyncScope(() => receive(job)).then(value => { remember(job.url, value); job.resolve(value); }, job.reject).finally(() => {
                flights.delete(job.key); job.context.emitDestroy(); active--; if (isBackground) background--; pump();
            });
        }
    };
    return {
        async fetch(input: URL | string, timeoutMs = 30_000, priority: OrdoPriority = 'interactive'): Promise<Response> {
            const url = new URL(input); url.searchParams.sort();
            const address = url.toString(), key = `${timeoutMs}:${address}`;
            prune(); const hit = cache.get(address);
            let value: Snapshot;
            if (hit) value = hit.value;
            else {
                let job = flights.get(key);
                if (job && priority === 'interactive' && job.priority === 'background' && waiting.includes(job)) {
                    job.priority = 'interactive'; pump();
                }
                if (!job) {
                    if (waiting.filter(item => item.priority === priority).length >= maxWaiting)
                        throw new Error('Очередь сборщика последований переполнена');
                    let resolve!: Job['resolve'], reject!: Job['reject'];
                    const work = new Promise<Snapshot>((yes, no) => { resolve = yes; reject = no; });
                    job = { key, url: address, deadline: Date.now() + timeoutMs, priority, context: new AsyncResource('ordo-upstream-request'), work, resolve, reject,
                        timer: setTimeout(() => {
                            const index = waiting.indexOf(job!);
                            if (index >= 0) { waiting.splice(index, 1); flights.delete(key); job!.context.emitDestroy(); reject(new OrdoTransportTimeout()); pump(); }
                        }, timeoutMs) };
                    flights.set(key, job); waiting.push(job); pump();
                }
                value = await job.work;
            }
            return new Response([204, 304].includes(value.status) ? null : value.bytes as BodyInit,
                { status: value.status, statusText: value.statusText, headers: value.headers });
        },
        stats: () => ({ active, background, waiting: waiting.length, flights: flights.size, retained }),
    };
}
const shared = globalThis as typeof globalThis & { __typikonOrdoTransportV1?: ReturnType<typeof createOrdoTransport> };
export const fetchOrdo = (url: URL | string, timeoutMs = 30_000, priority: OrdoPriority = 'interactive') =>
    (shared.__typikonOrdoTransportV1 ??= createOrdoTransport()).fetch(url, timeoutMs, priority);
