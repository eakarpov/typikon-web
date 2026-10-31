export const MY_TEMPLE_KEY = 'typikon:my-temple';
export interface MyTempleValue { slug: string; name: string; place?: string | null }
export interface AccountTemple { temple: MyTempleValue | null; initialized: boolean; unavailable: boolean }
export class MyTempleError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const validTempleSlug = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,199}$/i.test(value);
export function parseTempleChoice(raw: unknown): { slug: string | null; migrate: boolean } | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const body = raw as Record<string, unknown>;
    if (body.slug !== null && !validTempleSlug(body.slug)) return null;
    if (body.migrate !== undefined && typeof body.migrate !== 'boolean') return null;
    if (body.migrate && body.slug === null) return null;
    return { slug: body.slug as string | null, migrate: body.migrate === true };
}
export function decodeLocalTemple(raw: string | null): MyTempleValue | null {
    try { const value = raw ? JSON.parse(raw) : null;
        return value && validTempleSlug(value.slug) && typeof value.name === 'string' && value.name.trim()
            ? { slug: value.slug, name: value.name } : null;
    } catch { return null; }
}
export function readLocalTemple(): MyTempleValue | null {
    try { return typeof window === 'undefined' ? null : decodeLocalTemple(window.localStorage.getItem(MY_TEMPLE_KEY)); }
    catch { return null; }
}
