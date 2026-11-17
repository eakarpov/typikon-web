import { createHash, randomUUID } from 'node:crypto';
import Ajv from 'ajv';
import spec from '@/data/reader/openapi.json';

export type Obj = Record<string, any>;
export const CONTRACT = 'cs-reader/1';
export const PILOT = 'cs-mvp-pilot-01';
export const LIMITS = { catalogDefault: 20, catalogMax: 50, searchDefault: 20, searchMax: 50, readDefaultUnits: 10, readMaxUnits: 20, lookupMaxTokens: 20, maxRequestBytes: 65536, maxRawWindowUtf16: 65536, maxResponseBytes: 4194304, maxManifestUnits: 256 };
export class ReaderError extends Error {
    constructor(public code: string, public status: number, message: string, public details: Obj = {}, public retryable = false) { super(message); }
}
export function fail(code: string, status: number, message: string, details: Obj = {}): never { throw new ReaderError(code, status, message, details, status === 429 || status >= 500); }
export function utf16(text: string) {
    for (let i = 0; i < text.length; i++) { const n = text.charCodeAt(i); if (n >= 0xd800 && n <= 0xdbff) { const m = text.charCodeAt(++i); if (!(m >= 0xdc00 && m <= 0xdfff)) fail('invalid_utf16', 400, 'Непарный суррогат.'); } else if (n >= 0xdc00 && n <= 0xdfff) fail('invalid_utf16', 400, 'Непарный суррогат.'); }
    return text;
}
export function canonical(value: any): string {
    if (value === null || typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'string') return JSON.stringify(utf16(value));
    if (typeof value === 'number') { if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw Error('Invalid canonical number'); return String(value); }
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => { if (!/^[\x00-\x7f]*$/.test(k)) throw Error('Non-ASCII canonical key'); return JSON.stringify(k) + ':' + canonical(value[k]); }).join(',') + '}';
    throw Error('Invalid canonical value');
}
export const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const revision = (prefix: string, value: any) => prefix + '_' + sha(canonical(value));
export const newId = (prefix: string) => prefix + '_' + randomUUID().replace(/-/g, '');
export const nativeKey = (ref: Obj) => ref.namespace + ':' + ref.id;
export function equal(a: any, b: any) { return canonical(a) === canonical(b); }
const ajv = new Ajv({ allErrors: true, jsonPointers: true, unknownFormats: 'ignore', logger: false });
ajv.addSchema({ $id: 'reader-contract', components: spec.components }, 'reader-contract');
const validators = new Map<string, Ajv.ValidateFunction>();
export function validate(name: string, value: any) {
    let check = validators.get(name); if (!check) { check = ajv.compile({ $ref: 'reader-contract#/components/schemas/' + name }); validators.set(name, check); }
    if (!check(value)) fail('invalid_request', 400, 'Неверная форма запроса.', { schema: name, errors: check.errors?.slice(0, 5).map(e => ({ path: e.dataPath, keyword: e.keyword })) });
}
export function limit(value: any, fallback: number, max: number) { const n = value === undefined ? fallback : Number(value); if (!Number.isSafeInteger(n) || n < 1 || n > max) fail('invalid_request', 400, 'Неверный размер страницы.'); return n; }
export function envelope(data: any, warnings: any[] = []) { return { contract: CONTRACT, data, warnings }; }
export function cursorEncode(value: Obj) { return Buffer.from(canonical(value)).toString('base64url'); }
export function cursorDecode(raw: string, expected: Obj): Obj {
    if (raw.length > 4096) fail('cursor_mismatch', 409, 'Курсор не подходит.');
    let data: Obj; try { data = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')); } catch { fail('cursor_mismatch', 409, 'Курсор не прочитан.'); }
    if (!data! || !Number.isSafeInteger(data!.offset) || data!.offset < 0 || Object.entries(expected).some(([k, v]) => !equal(data![k] ?? null, v))) fail('cursor_mismatch', 409, 'Курсор относится к другому снимку или запросу.');
    return data!;
}
export function addressQuery(url: URL): Obj {
    const known = ['revision', 'passport', 'occurrence', 'fragment', 'from', 'to', 'view', 'accents'];
    for (const k of known) if (url.searchParams.getAll(k).length > 1 || url.searchParams.has(k) && !url.searchParams.get(k)) fail('invalid_address', 400, 'Повторный или пустой параметр адреса.');
    const get = (k: string) => url.searchParams.get(k);
    if (Number(!!get('occurrence')) + Number(!!get('fragment')) + Number(!!(get('from') || get('to'))) > 1 || !!get('from') !== !!get('to')) fail('invalid_address', 400, 'Смешаны селекторы адреса.');
    return { ...(get('revision') ? { sourceRevision: get('revision') } : {}), ...(get('passport') ? { passportRevision: get('passport') } : {}), ...(get('occurrence') ? { selector: { kind: 'occurrence', occurrenceId: get('occurrence') } } : get('fragment') ? { selector: { kind: 'fragment', fragmentId: get('fragment') } } : get('from') ? { selector: { kind: 'range', startFragmentId: get('from'), endFragmentId: get('to') } } : {}) };
}
