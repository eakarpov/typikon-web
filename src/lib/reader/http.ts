import { configuredIndex, profileFingerprints } from './index/store';
import { canonical } from './core';
import { readerAccess } from './index/access';
import { ReaderService } from './service';
import { readerDb } from './registry';
import { CONTRACT, ReaderError, envelope, LIMITS, fail, type Obj } from './core';
import readerSpecification from '@/data/reader/openapi.json';
import indexSpecification from '@/data/reader/index-openapi.json';
const specification = { ...readerSpecification, paths: { ...readerSpecification.paths, ...indexSpecification.paths } };
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key, If-None-Match', 'Access-Control-Expose-Headers': 'ETag, Retry-After, Deprecation, Link, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Window', 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' };
export const options = () => new Response(null, { status: 204, headers: cors });
async function bodyOf(request: Request) { const reader = request.body?.getReader(); let size = 0; const chunks: Uint8Array[] = []; if (reader) for (; ;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > LIMITS.maxRequestBytes) { await reader.cancel(); fail('request_too_large', 413, 'Запрос слишком большой.'); } chunks.push(part.value); } try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); } catch { fail('invalid_request', 400, 'Неверный JSON.'); } }
export async function handle(request: Request, action: string, sourceId?: string): Promise<Response> {
    let accessHeaders: Record<string, string> = {};
    try {
        const access = await readerAccess(request, action, CONTRACT); accessHeaders = access.headers;
        if (access.denied) { const payload = await access.denied.json(); return new Response(JSON.stringify({ contract: CONTRACT, error: { ...payload.error, retryable: access.denied.status === 429 } }), { status: access.denied.status, headers: { ...cors, ...Object.fromEntries(access.denied.headers), 'Cache-Control': 'no-store' } }); }
        const url = new URL(request.url); const query: Obj = {}; for (const [key, value] of url.searchParams) { if (key in query) fail('invalid_request', 400, 'Повторный параметр.'); query[key] = value; }
        const isGet = ['capabilities', 'catalog', 'passport', 'search', 'openapi'].includes(action); if (request.method !== (isGet ? 'GET' : 'POST')) return new Response(JSON.stringify({ contract: CONTRACT, error: { code: 'invalid_request', message: 'Метод не поддержан.', retryable: false } }), { status: 405, headers: { ...cors, Allow: isGet ? 'GET, OPTIONS' : 'POST, OPTIONS' } });
        if (action === 'openapi') return new Response(JSON.stringify(specification), { headers: { ...cors, 'Cache-Control': 'public, max-age=300' } });
        const service = new ReaderService(await readerDb()); let data: any;
        if (action === 'capabilities') data = service.capabilities();
        else if (action === 'catalog') data = await service.catalog(query);
        else if (action === 'passport') data = await service.passport(sourceId!, query.revision);
        else if (action === 'search') data = await service.search(query);
        else { const input = await bodyOf(request); if (input?.contract !== CONTRACT) fail('unsupported_contract', 422, 'Версия контракта не поддерживается.'); if (action === 'resolve') data = await service.resolve(input); else if (action === 'read') data = await service.read(input); else if (action === 'lookup') data = await service.lookup(input); else fail('not_found', 404, 'Метод не найден.'); }
        const text = JSON.stringify(envelope(data)); if (Buffer.byteLength(text) > LIMITS.maxResponseBytes) fail('response_too_large', 413, 'Ответ превышает бюджет; выберите окно.');
        const { sha } = await import('./core'); const etag = '"' + sha(text) + '"'; const cache = request.method === 'GET' && ['capabilities', 'catalog', 'passport'].includes(action) && access.kind !== 'token' ? 'public, max-age=' + (action === 'capabilities' ? 300 : 0) : 'no-store';
        let indexReady = false; if (action === 'search' && process.env.CS_CORPUS_INDEX_DB) { try { const index = configuredIndex(); try { indexReady = canonical(index.manifest.profileFingerprints) === canonical(profileFingerprints()); } finally { index.db.close(); } } catch { /* Keep legacy search available while replacement is unpublished. */ } }
        const headers = { ...cors, ...accessHeaders, 'Cache-Control': ['catalog','passport'].includes(action) ? 'no-cache, must-revalidate' : cache, ETag: etag, ...(indexReady ? { Deprecation: 'true', Link: '</api/v2/study/reader/v1/index/search>; rel="successor-version"' } : {}), ...(access.kind === 'token' ? { Vary: 'Authorization' } : {}) };
        if (cache !== 'no-store' && request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers }); return new Response(text, { headers });
    } catch (error) { const e = error instanceof ReaderError ? error : new ReaderError('internal', 500, 'Не удалось обработать reader-запрос.', {}, true); return new Response(JSON.stringify({ contract: CONTRACT, error: { code: e.code, message: e.message, retryable: e.retryable, details: e.details } }), { status: e.status, headers: { ...cors, ...accessHeaders, 'Cache-Control': 'no-store' } }); }
}
