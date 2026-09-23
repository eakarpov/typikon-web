// Поездка: дни, остановки и что сохранить для чтения без сети. Чистая часть;
// сборка состава дней по базе — в ./plan.
//
// ПОЕЗДКА ЛЕЖИТ В БРАУЗЕРЕ, а не в учётной записи. Маршрут — сведения личные, и
// сервер знает о нём лишь на время одного запроса состава; а открываться
// страница поездки должна там, где сети нет, — значит, из того, что уже на
// устройстве.

export const MAX_TRIP_DAYS = 31;
export const MAX_STOPS = 20;
/** Ключ localStorage; значение — список поездок. */
export const TRIPS_KEY = "typikon:trips";

export type StopKind = "temple" | "place";
export interface TripStop { kind: StopKind; slug: string; name: string }
export interface Trip { id: string; title: string; from: string; to: string; stops: TripStop[]; createdAt: string }

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86400000;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Дни поездки включительно; null — даты неверны, перепутаны или поездка длиннее предела. */
export const tripDays = (from: string, to: string): string[] | null => {
    if (!ISO.test(from) || !ISO.test(to)) return null;
    const a = toTime(from), b = toTime(to);
    if (Number.isNaN(a) || Number.isNaN(b) || a > b) return null;
    const n = Math.round((b - a) / DAY) + 1;
    if (n > MAX_TRIP_DAYS) return null;
    return Array.from({ length: n }, (_, i) => new Date(a + i * DAY).toISOString().slice(0, 10));
};

export interface TripRequest { from: string; to: string; stops: { kind: StopKind; slug: string }[] }

/** Запрос состава поездки: даты и остановки; лишнее отбрасывается, неверное — отказ. */
export const parseTripRequest = (raw: unknown): { ok: true; value: TripRequest; days: string[] } | { ok: false; error: string } => {
    const body = (raw ?? {}) as Record<string, any>;
    const from = String(body.from ?? "");
    const to = String(body.to ?? "");
    const days = tripDays(from, to);
    if (!days) return { ok: false, error: `нужны даты поездки, не длиннее ${MAX_TRIP_DAYS} дней` };
    const stops = (Array.isArray(body.stops) ? body.stops : [])
        .filter((s: any) => (s?.kind === "temple" || s?.kind === "place") && /^[a-z0-9-]{1,200}$/i.test(String(s?.slug ?? "")))
        .map((s: any) => ({ kind: s.kind as StopKind, slug: String(s.slug) }));
    if (stops.length > MAX_STOPS) return { ok: false, error: `остановок не больше ${MAX_STOPS}` };
    return { ok: true, value: { from, to, stops }, days };
};

export interface SaveItem { url: string; label: string }

/**
 * Что сохранить для чтения без сети. Страница дня несёт полные тексты чтений и
 * зачал, и отдельные /reading/… для неё не нужны. Страницы храмов, мест и
 * святых маршрута — чтобы на месте было что прочесть о нём.
 */
export const saveListOf = (
    days: string[],
    stops: { href: string; name: string }[],
    saints: { href: string; name: string }[],
    humanDate: (iso: string) => string,
): SaveItem[] => {
    const seen = new Set<string>();
    const out: SaveItem[] = [];
    const add = (url: string, label: string) => { if (!seen.has(url)) { seen.add(url); out.push({ url, label }); } };
    for (const d of days) add(`/calculator/${d}`, `Чтения на ${humanDate(d)}`);
    for (const s of stops) add(s.href, s.name);
    for (const s of saints) add(s.href, s.name);
    return out;
};

/** Сколько займёт сохранённое: страница дня около полумегабайта, общие файлы — один раз. */
export const estimateBytes = (pages: number, alreadySaved = false) =>
    pages * 500_000 + (alreadySaved ? 0 : 2_500_000);

export const newTripId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
