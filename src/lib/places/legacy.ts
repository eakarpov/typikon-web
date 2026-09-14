// Перевод прежних полей места в новую модель (см. @/lib/places/schema).
//
// Записи `places` заводились руками: координаты лежат строками («39.9199»), другие
// имена — плоским списком `synonyms`. Новая модель держит точку в GeoJSON (ради
// индекса 2dsphere, как у храмов) и имена списком `names` с языком и ролью.
//
// Старые поля не удаляются: на `latitude`/`longitude` и `synonyms` смотрят
// публичный API v2 и редактор. Пока они живы, новые выводятся из них — и при
// миграции, и при каждом сохранении из админки, — чтобы два представления не
// разошлись.
import type { PlaceLocation, PlaceName } from "@/lib/places/schema";

/** Разбор координаты: число или строка с числом; иначе `null`. */
export const coordinate = (value: unknown): number | null => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string" || !value.trim()) return null;
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Точка GeoJSON из пары координат. Вне допустимых пределов — `null`: перепутанные
 * местами широта и долгота дают точку, которую индекс 2dsphere откажется принять
 * (широта за 90), и лучше не записать её вовсе, чем уронить запись целиком.
 */
export const toLocation = (latitude: unknown, longitude: unknown): PlaceLocation | null => {
    const lat = coordinate(latitude);
    const lon = coordinate(longitude);
    if (lat === null || lon === null) return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { type: "Point", coordinates: [lon, lat] };
};

/** Широта и долгота места: из `location`, а за его отсутствием — из старых полей. */
export const placeCoordinates = (row: any): { latitude: number; longitude: number } | null => {
    const coords = row?.location?.coordinates;
    if (Array.isArray(coords) && coords.length === 2) {
        const [longitude, latitude] = coords;
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude };
    }
    const location = toLocation(row?.latitude, row?.longitude);
    return location ? { latitude: location.coordinates[1], longitude: location.coordinates[0] } : null;
};

/**
 * Имена из `synonyms`. Роль у всех — `variant`: откуда взялось имя и к какой эпохе
 * оно относится, по плоскому списку не узнать. Уже заведённые имена с другими
 * ролями (из импорта) сохраняются; варианты заменяются списком из редактора
 * целиком — иначе удалённый в редакторе синоним воскресал бы при сохранении.
 * Имя, совпадающее с основным названием или с неварианным именем, не дублируется.
 */
export const namesWithSynonyms = (
    names: PlaceName[] | undefined,
    synonyms: unknown,
    name?: string,
): PlaceName[] => {
    const kept = (names ?? []).filter((n) => n.role !== "variant");
    const taken = new Set([name, ...kept.map((n) => n.name)].filter(Boolean).map((s) => s!.trim().toLowerCase()));
    const variants: PlaceName[] = [];
    for (const raw of Array.isArray(synonyms) ? synonyms : []) {
        if (typeof raw !== "string") continue;
        const value = raw.trim();
        const key = value.toLowerCase();
        if (!value || taken.has(key)) continue;
        taken.add(key);
        variants.push({ name: value, lang: "ru", role: "variant", source: "editor" });
    }
    return [...kept, ...variants];
};
