// Свод «что рядом» — чистая часть, без базы: разбор точки, свод храмов по
// престолам, ближайший престольный праздник. Выборки — в ./nearby.

import { nextFeast, type TempleFeast } from "@/utils/feastDate";

/**
 * Точность точки — два знака после запятой, около километра.
 *
 * Точнее ни к чему: храмы «рядом» считаются на десятки километров. А грубее
 * точка — меньше о человеке: адрес запроса оседает в журналах сервера, и
 * километровая клетка там безопаснее подъезда. Округляется ещё в браузере,
 * до того как точка уйдёт в адрес страницы.
 */
export const roundCoord = (x: number) => Math.round(x * 100) / 100;

export const DEFAULT_RADIUS_KM = 15;
export const MAX_RADIUS_KM = 50;
/** Радиусы, которые предлагает страница; иные из адреса приводятся к ближайшему допустимому. */
export const RADII_KM = [5, 15, 30, 50] as const;

export interface NearbyPoint { lat: number; lon: number; radiusKm: number }

/** Точка из строки запроса; null — точки нет или она не на Земле. */
export const parsePoint = (lat: unknown, lon: unknown, radius?: unknown): NearbyPoint | null => {
    const la = Number(lat);
    const lo = Number(lon);
    if (lat === null || lat === undefined || lat === "" || lon === null || lon === undefined || lon === "") return null;
    if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
    const r = Number(radius);
    const radiusKm = Number.isFinite(r) && r > 0 ? Math.min(MAX_RADIUS_KM, Math.max(1, Math.round(r))) : DEFAULT_RADIUS_KM;
    return { lat: roundCoord(la), lon: roundCoord(lo), radiusKm };
};

/** Расстояние для человека: до десяти километров с десятыми, дальше целыми. */
export const formatDistance = (km: number) =>
    km < 1 ? "меньше километра" : km < 10 ? `${km.toFixed(1).replace(".", ",")} км` : `${Math.round(km)} км`;

// ── Свод по престолам ────────────────────────────────────────────────────────

export interface NearTempleRow {
    slug: string;
    name: string;
    place?: string | null;
    latitude: number;
    longitude: number;
    /** Метры — так их отдаёт $geoNear. */
    distance: number;
    prestoly?: { dedication: string; label: string; isMain: boolean; state?: string; status?: string; confidence?: number }[];
}

export interface DedicationRow {
    slug: string;
    short: string;
    label: string;
    kind: string;
    feasts: TempleFeast[];
    saints: { dneslovId: string; name: string | null; slug: string | null }[];
}

export interface NearTemple { slug: string; name: string; place: string | null; distanceKm: number; lat: number; lon: number }

export interface NearDedication {
    slug: string;
    short: string;
    label: string;
    kind: string;
    /**
     * Святые, за которыми посвящение стоит ВЫВЕРЕННО. Пусто — не «святого нет», а
     * «связь не проверена» (или посвящение Господское и Богородичное): кандидаты
     * сопоставителя сюда не идут, на странице они выглядели бы фактом.
     */
    saints: { name: string; slug: string | null }[];
    temples: NearTemple[];
    nearestKm: number;
    /** Престол хотя бы у одного храма выверен, а не выведен из названия. */
    anyApproved: boolean;
    next: { date: string; memoryLabel: string | null; movable: boolean } | null;
}

const km = (meters: number) => Math.round(meters / 100) / 10;

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Храмы рядом, сведённые по престолам: кто здесь почитается и где ближе всего.
 *
 * Считается КАЖДЫЙ престол храма, а не только главный: Никольский придел в
 * Успенском храме — такое же место почитания святителя, как Никольский храм.
 * Утраченные престолы в свод не идут: человеку, ищущему, где помолиться, от
 * упразднённого придела пользы нет.
 */
export const summarizeByDedication = (
    temples: NearTempleRow[],
    dedications: DedicationRow[],
    today: Date,
): NearDedication[] => {
    const bySlug = new Map(dedications.map((d) => [d.slug, d]));
    const groups = new Map<string, NearDedication>();

    for (const t of temples) {
        const seen = new Set<string>();
        for (const p of t.prestoly ?? []) {
            if (p.state === "lost" || seen.has(p.dedication)) continue;
            seen.add(p.dedication);
            const doc = bySlug.get(p.dedication);
            if (!doc) continue;
            let group = groups.get(doc.slug);
            if (!group) {
                const next = nextFeast(doc.feasts ?? [], today);
                group = {
                    slug: doc.slug,
                    short: doc.short ?? doc.slug,
                    label: doc.label ?? doc.short ?? doc.slug,
                    kind: doc.kind,
                    saints: (doc.saints ?? [])
                        .filter((s) => s.name)
                        .map((s) => ({ name: s.name as string, slug: s.slug })),
                    temples: [],
                    nearestKm: Infinity,
                    anyApproved: false,
                    next: next
                        ? { date: iso(next.date), memoryLabel: next.feast.memoryLabel ?? null, movable: next.feast.paschaOffset !== undefined }
                        : null,
                };
                groups.set(doc.slug, group);
            }
            const distanceKm = km(t.distance);
            group.temples.push({ slug: t.slug, name: t.name, place: t.place ?? null, distanceKm, lat: t.latitude, lon: t.longitude });
            group.nearestKm = Math.min(group.nearestKm, distanceKm);
            if (p.status === "approved") group.anyApproved = true;
        }
    }

    // Порядок — по ближайшему храму: человеку с телефоном в руке важнее, куда
    // дойти, чем что встречается чаще. Равные — по числу храмов.
    return [...groups.values()]
        .map((g) => ({ ...g, temples: g.temples.sort((a, b) => a.distanceKm - b.distanceKm) }))
        .sort((a, b) => a.nearestKm - b.nearestKm || b.temples.length - a.temples.length || a.short.localeCompare(b.short, "ru"));
};
