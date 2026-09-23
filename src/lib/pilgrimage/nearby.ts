// «Что рядом»: храмы, престолы, места и святыни у точки. Свод и проверка
// точки — в ./summary, реестр святынь — в ./relicsStore.

import clientPromise from "@/lib/mongodb";
import { cached, CacheTag } from "@/lib/cache";
import { reportError } from "@/lib/reportError";
import { filterOf } from "@/lib/temples";
import { placeHref, saintsOfPlace, type SaintOfPlace } from "@/lib/places/query";
import { PLACES } from "@/lib/places/schema";
import { relicsNear, type NearRelic } from "./relicsStore";
import { summarizeByDedication, type DedicationRow, type NearDedication, type NearTempleRow } from "./summary";

/** Больше храмов в свод не берём: в центре Москвы их в пятнадцати километрах сотни. */
const TEMPLE_LIMIT = 300;
const PLACE_LIMIT = 20;
/** У скольких ближайших мест спрашиваем святых — каждое стоит отдельной выборки. */
const PLACES_WITH_SAINTS = 8;

export interface NearPlace {
    id: string;
    name: string;
    href: string;
    kind: string | null;
    distanceKm: number;
    /** Святые, в чтениях памяти которых место упомянуто — не родина и не кафедра. */
    saints: SaintOfPlace[];
}

export interface Nearby {
    point: { lat: number; lon: number; radiusKm: number };
    /** Сколько храмов нашлось в радиусе (в своде — не больше TEMPLE_LIMIT ближайших). */
    templeCount: number;
    /** Храмов больше предела: свод построен по ближайшим. */
    truncated: boolean;
    dedications: NearDedication[];
    /** Храмы, чей престол не разобран: их тоже стоит показать — они рядом. */
    unparsed: { slug: string; name: string; distanceKm: number; lat: number; lon: number }[];
    places: NearPlace[];
    relics: NearRelic[];
}

const loadTemples = async (lon: number, lat: number, radiusKm: number): Promise<NearTempleRow[]> => {
    const rows = await (await clientPromise).db("typikon").collection("temples").aggregate([
        { $geoNear: {
            near: { type: "Point", coordinates: [lon, lat] }, distanceField: "distance",
            maxDistance: radiusKm * 1000, spherical: true,
            // Тот же отбор, что у указателя и карты: без построек и неправославных.
            query: filterOf({}),
        } },
        { $limit: TEMPLE_LIMIT + 1 },
        { $project: { _id: 0, slug: 1, name: 1, place: 1, latitude: 1, longitude: 1, distance: 1,
            "prestoly.dedication": 1, "prestoly.label": 1, "prestoly.isMain": 1, "prestoly.state": 1,
            "prestoly.status": 1, "prestoly.confidence": 1 } },
    ]).toArray();
    return rows as unknown as NearTempleRow[];
};

const loadDedications = async (slugs: string[]): Promise<DedicationRow[]> => {
    if (!slugs.length) return [];
    const rows = await (await clientPromise).db("typikon").collection("dedications")
        .find({ slug: { $in: slugs } },
            { projection: { _id: 0, slug: 1, short: 1, label: 1, kind: 1, feasts: 1, saints: 1 } })
        .toArray();
    return rows as unknown as DedicationRow[];
};

const loadPlaces = async (lon: number, lat: number, radiusKm: number): Promise<NearPlace[]> => {
    const rows = await (await clientPromise).db("typikon").collection(PLACES).aggregate([
        { $geoNear: {
            near: { type: "Point", coordinates: [lon, lat] }, distanceField: "distance",
            maxDistance: radiusKm * 1000, spherical: true, query: { published: { $ne: false } },
        } },
        { $limit: PLACE_LIMIT },
        { $project: { name: 1, slug: 1, alias: 1, kind: 1, distance: 1 } },
    ]).toArray();
    const saints = await Promise.all(rows.slice(0, PLACES_WITH_SAINTS).map((r) => saintsOfPlace(String(r._id))));
    return rows.map((r, i) => ({
        id: String(r._id),
        name: r.name,
        href: placeHref(r),
        kind: r.kind ?? null,
        distanceKm: Math.round(r.distance / 100) / 10,
        saints: saints[i] ?? [],
    }));
};

/**
 * Выборки порознь и каждая со своим отказом: упавший поиск мест не должен
 * прятать храмы, а пустой реестр святынь — всё остальное.
 */
const loadNearby = async (lat: number, lon: number, radiusKm: number, today: string): Promise<Nearby> => {
    const settle = async <T,>(what: string, p: Promise<T>, empty: T): Promise<T> => {
        try { return await p; } catch (e) {
            // Точку в журнал не пишем: адрес человека там незачем.
            reportError(e, { where: `lib/pilgrimage/nearby#${what}` });
            return empty;
        }
    };

    const [temples, places, relics] = await Promise.all([
        settle("temples", loadTemples(lon, lat, radiusKm), [] as NearTempleRow[]),
        settle("places", loadPlaces(lon, lat, radiusKm), [] as NearPlace[]),
        relicsNear(lon, lat, radiusKm),
    ]);
    const truncated = temples.length > TEMPLE_LIMIT;
    const kept = temples.slice(0, TEMPLE_LIMIT);

    const slugs = [...new Set(kept.flatMap((t) => (t.prestoly ?? []).map((p) => p.dedication)))];
    const dedicationDocs = await settle("dedications", loadDedications(slugs), [] as DedicationRow[]);
    const dedications = summarizeByDedication(kept, dedicationDocs, new Date(`${today}T00:00:00Z`));
    const known = new Set(dedicationDocs.map((d) => d.slug));

    return {
        point: { lat, lon, radiusKm },
        templeCount: kept.length,
        truncated,
        dedications,
        unparsed: kept
            .filter((t) => !(t.prestoly ?? []).some((p) => known.has(p.dedication) && p.state !== "lost"))
            .slice(0, 30)
            .map((t) => ({ slug: t.slug, name: t.name, distanceKm: Math.round(t.distance / 100) / 10, lat: t.latitude, lon: t.longitude })),
        places,
        relics,
    };
};

/**
 * Кэш по округлённой точке, радиусу и дню. День в ключе — потому что от него
 * зависит «ближайший престольный праздник»; точка округлена ещё до вызова
 * (@/lib/pilgrimage/summary#parsePoint), и соседи по километровой клетке
 * получают один и тот же ответ.
 */
export const nearby = cached(loadNearby, ["pilgrimage-nearby"],
    [CacheTag.TEMPLES, CacheTag.PLACES, CacheTag.SAINTS, CacheTag.RELICS]);
