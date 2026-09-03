// Мера разброса точек по земле: средоточие, ареал и куда он сдвинулся.
//
// ЗАЧЕМ ОТДЕЛЬНЫЙ МОДУЛЬ. Та же самая мера нужна теперь в двух местах: разделу
// «География посвящения» — один раз на сервере (getDedicationStats), и оси
// времени — на каждый шаг ползунка, в браузере. Считать одно и то же двумя
// кусками кода нельзя: они разойдутся на первой же правке, и страница станет
// показывать два разных ареала одного посвящения.
//
// Здесь нет ни базы, ни React — только арифметика, и потому она проверяется
// тестом (geoSpread.test.ts), а не разглядыванием карты.

export interface GeoPoint {
    lat: number;
    lon: number;
}

/** Значение на доле `p` в УЖЕ отсортированном ряду. */
export const quantile = (sorted: number[], p: number): number =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

/**
 * Расстояние по земле, км. Точности «сколько сотен вёрст» хватает с запасом:
 * ареал почитания меряется десятками и сотнями километров, и поправка на
 * сфероид тут ничего не меняет.
 */
export const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const dLat = (lat2 - lat1) * 111;
    const dLon = (lon2 - lon1) * 111 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
    return Math.hypot(dLat, dLon);
};

export interface Spread {
    /** Средоточие: МЕДИАНА широты и долготы, а не среднее. */
    center: GeoPoint | null;
    /** Медианное удаление от средоточия, км. */
    radiusMedianKm: number | null;
    /** Удаление, вмещающее четыре пятых точек, км. */
    radius80Km: number | null;
}

/**
 * Ареал набора точек.
 *
 * Медиана, а не среднее, — и это не вкус, а необходимость: один храм в
 * диаспоре уводит среднее на тысячи вёрст, а медиану — никуда.
 */
export const spreadOf = (points: GeoPoint[]): Spread => {
    if (!points.length) return { center: null, radiusMedianKm: null, radius80Km: null };

    const lats = points.map((p) => p.lat).sort((a, b) => a - b);
    const lons = points.map((p) => p.lon).sort((a, b) => a - b);
    const center = { lat: quantile(lats, 0.5), lon: quantile(lons, 0.5) };

    const distances = points
        .map((p) => distanceKm(center.lat, center.lon, p.lat, p.lon))
        .sort((a, b) => a - b);

    return {
        center,
        radiusMedianKm: Math.round(quantile(distances, 0.5)),
        radius80Km: Math.round(quantile(distances, 0.8)),
    };
};

// ── Куда сдвинулось средоточие ───────────────────────────────────────────────

const RHUMBS = [
    "к северу", "к северо-востоку", "к востоку", "к юго-востоку",
    "к югу", "к юго-западу", "к западу", "к северо-западу",
];

/**
 * Сдвиг короче этого называть движением не стоит: полсотни вёрст на карте
 * страны — дрожание от того, какой именно храм оказался медианным, а не
 * распространение почитания.
 */
export const NOTABLE_SHIFT_KM = 50;

export interface Shift {
    km: number;
    /** «к востоку», «к юго-западу». */
    where: string;
}

/**
 * Сдвиг средоточия словами. `null` — сдвига нет или он меньше того, что стоит
 * называть движением: сказать «ушло на три версты к северу» значит выдать шум
 * за наблюдение.
 */
export const shiftOf = (from: GeoPoint | null, to: GeoPoint | null): Shift | null => {
    if (!from || !to) return null;
    const km = distanceKm(from.lat, from.lon, to.lat, to.lon);
    if (km < NOTABLE_SHIFT_KM) return null;

    const north = (to.lat - from.lat) * 111;
    const east = (to.lon - from.lon) * 111 * Math.cos(((from.lat + to.lat) / 2) * Math.PI / 180);
    // Румб отсчитываем от севера по часовой стрелке, как принято на карте.
    const angle = (Math.atan2(east, north) * 180 / Math.PI + 360) % 360;
    return { km: Math.round(km), where: RHUMBS[Math.round(angle / 45) % 8] };
};
