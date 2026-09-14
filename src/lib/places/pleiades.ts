// Обогащение мест из Pleiades (CC BY 3.0, https://pleiades.stoa.org): имена
// античных и позднейших эпох с годами, периоды существования места и точка для
// тех, у кого её нет.
//
// Берутся дампы pleiades-names и pleiades-places (CSV). У имени в дампе —
// засвидетельствованная форма в своём письме (`nameAttested`), транслитерация,
// язык и годы (`minDate`/`maxDate`); у места — точка, её точность и ключи эпох.
//
// ЧТО ОТБРАСЫВАЕТСЯ. Позднейшие западные экзонимы (en, de, fr, it, ka — «Scanderia»,
// «Alexandria» с немецкой пометкой): это не история места, а история картографии.
// Верхняя граница 2099–2100 — условное «по сей день», её не пишем.
//
// Периоды — только общие эпохи средиземноморской хронологии Pleiades, с их же
// границами; частные региональные ключи («neo-assyrian-babylonian-middle-east»)
// в периоды не идут: для них нет устоявшегося русского названия, а пересказ
// каждого был бы уже нашей интерпретацией.
import type { PlaceLocation, PlaceName, PlacePeriod } from "@/lib/places/schema";

export type CsvRow = Record<string, string>;

const EXONYM_LANGS = new Set(["en", "de", "fr", "it", "es", "ka"]);
const OPEN_END = 2000;

/** Эпохи Pleiades с их границами и русскими названиями. */
export const PERIODS: Record<string, { label: string; from: number; to: number }> = {
    "archaic": { label: "архаика", from: -750, to: -550 },
    "classical": { label: "классическая эпоха", from: -550, to: -330 },
    "hellenistic-republican": { label: "эллинистическая эпоха", from: -330, to: -30 },
    "roman": { label: "римская эпоха", from: -30, to: 300 },
    "late-antique": { label: "поздняя античность", from: 300, to: 640 },
    "mediaeval-byzantine": { label: "византийская эпоха", from: 640, to: 1453 },
    "modern": { label: "новое время", from: 1700, to: 2100 },
};

export const pidOf = (path: string) => path.replace(/\/+$/, "").split("/").pop() ?? "";

const year = (value: string | undefined) => {
    if (!value?.trim()) return undefined;
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? n : undefined;
};

/**
 * Имена места из строк pleiades-names. Одинаковые имя и язык сливаются, годы
 * расширяются до общего охвата. Роль — историческая, если у имени есть год, когда
 * оно вышло из употребления («Angora», 1683–1918); открытое «по сей день» —
 * современная.
 */
export const namesFromRows = (rows: CsvRow[]): PlaceName[] => {
    const byKey = new Map<string, PlaceName>();
    for (const row of rows) {
        const lang = row.nameLanguage?.trim() || "und";
        if (EXONYM_LANGS.has(lang)) continue;
        const translits = (row.nameTransliterated ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        const attested = row.nameAttested?.trim();
        const name = attested || translits[0] || row.title?.trim();
        if (!name) continue;
        const transliteration = attested && translits[0] && translits[0] !== attested ? translits[0] : undefined;
        const from = year(row.minDate);
        const rawTo = year(row.maxDate);
        const to = rawTo !== undefined && rawTo >= OPEN_END ? undefined : rawTo;

        const key = `${name}|${lang}`;
        const prev = byKey.get(key);
        if (prev) {
            if (from !== undefined && (prev.from === undefined || from < prev.from)) prev.from = from;
            if (rawTo !== undefined && rawTo >= OPEN_END) delete prev.to;
            else if (to !== undefined && prev.to !== undefined && to > prev.to) prev.to = to;
            prev.role = prev.to !== undefined ? "historical" : "modern";
            prev.transliteration ??= transliteration;
            continue;
        }
        byKey.set(key, {
            name,
            lang,
            role: to !== undefined ? "historical" : "modern",
            source: "pleiades",
            ...(transliteration ? { transliteration } : {}),
            ...(from !== undefined ? { from } : {}),
            ...(to !== undefined ? { to } : {}),
        });
    }
    return [...byKey.values()].sort((a, b) => (a.from ?? Infinity) - (b.from ?? Infinity) || a.name.localeCompare(b.name));
};

export const periodsFromKeys = (keys: string | undefined): PlacePeriod[] =>
    (keys ?? "").split(",").map((k) => k.trim()).filter((k) => PERIODS[k])
        .map((k) => ({ ...PERIODS[k], source: "pleiades" as const }))
        .sort((a, b) => a.from! - b.from!);

/** Точка места: только «precise» и «rough» — «related» и «unlocated» указывают не на само место. */
export const locationFromRow = (row: CsvRow): { location: PlaceLocation; precision: "exact" | "approx" } | undefined => {
    if (row.locationPrecision !== "precise" && row.locationPrecision !== "rough") return undefined;
    const lat = Number(row.reprLat), lon = Number(row.reprLong);
    if (!row.reprLat || !row.reprLong || !Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
    return { location: { type: "Point", coordinates: [lon, lat] }, precision: row.locationPrecision === "precise" ? "exact" : "approx" };
};
