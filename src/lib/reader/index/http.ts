import { ReaderError, fail, sha, type Obj } from '../core';
import { ReaderService } from '../service';
import { readerDb } from '../registry';
import { INDEX_CONTRACT, INDEX_LIMITS } from './store';
import { CorpusIndexService } from './service';
import { readerAccess } from './access';
export const indexCors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key, If-None-Match', 'Access-Control-Expose-Headers': 'ETag, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Window', 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' };
export async function handleIndex(request: Request, action: string, supplied?: CorpusIndexService) {
    let accessHeaders: Record<string, string> = {};
    try {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: indexCors });
        if (request.method !== 'GET') return new Response(JSON.stringify({ contract: INDEX_CONTRACT, error: { code: 'invalid_request', message: 'Нужен GET.', retryable: false } }), { status: 405, headers: { ...indexCors, Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' } });
        if (!['capabilities', 'search', 'occurrences'].includes(action)) fail('not_found', 404, 'Метод индекса не найден.');
        const access = await readerAccess(request, action); accessHeaders = access.headers;
        if (access.denied) { const payload = await access.denied.json(); return new Response(JSON.stringify({ contract: INDEX_CONTRACT, error: { ...payload.error, retryable: access.denied.status === 429 } }), { status: access.denied.status, headers: { ...indexCors, ...Object.fromEntries(access.denied.headers), 'Cache-Control': 'no-store' } }); }
        const query: Obj = {};
        for (const [k, v] of new URL(request.url).searchParams) { if (k in query || !v) fail('invalid_request', 400, 'Повторный или пустой параметр.'); query[k] = v; }
        const service = supplied ?? new CorpusIndexService(new ReaderService(await readerDb()));
        const data = action === 'capabilities' ? await service.capabilities() : action === 'search' ? await service.search(query) : await service.occurrences(query);
        const text = JSON.stringify({ contract: INDEX_CONTRACT, data, warnings: [] });
        if (Buffer.byteLength(text) > INDEX_LIMITS.maxResponseBytes) fail('response_too_large', 413, 'Превышен бюджет ответа.');
        const etag = '"' + sha(text) + '"';
        const headers = { ...indexCors, ...accessHeaders, 'Cache-Control': action === 'capabilities' ? 'public, max-age=300' : 'no-store', ETag: etag };
        if (action === 'capabilities' && request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
        return new Response(text, { headers });
    } catch (error) {
        const e = error instanceof ReaderError ? error : new ReaderError('internal', 500, 'Не удалось прочитать индекс.', {}, true);
        return new Response(JSON.stringify({ contract: INDEX_CONTRACT, error: { code: e.code, message: e.message, details: e.details, retryable: e.retryable } }), { status: e.status, headers: { ...indexCors, ...accessHeaders, 'Cache-Control': 'no-store' } });
    }
}
