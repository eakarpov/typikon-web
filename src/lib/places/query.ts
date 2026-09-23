// Выборки мест для страниц сайта.
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { cached, CacheTag } from "@/lib/cache";
import { reportError } from "@/lib/reportError";
import { BIBLE_CANON } from "@/utils/bibleCanon";
import { saintNames, saintSlugs } from "@/lib/saints";
import { filterOf } from "@/lib/temples";
import { spanLabel } from "@/lib/places/labels";
import { PLACE_MENTIONS, PLACE_RELATIONS, PLACES } from "@/lib/places/schema";
import { haystackOf } from "@/lib/places/search";
import { placeCoordinates } from "@/lib/places/legacy";
import type { Confidence, PlaceKind, PlaceStatus, RelationType } from "@/lib/places/schema";

const db = async () => (await clientPromise).db("typikon");

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Адрес страницы места: наш слуг, прежний alias или идентификатор. */
export const placeHref = (row: { slug?: string; alias?: string; _id?: unknown; id?: string }) =>
    `/places/${row.slug || row.alias || row.id || String(row._id)}`;

// --- Места главы Библии

export interface ChapterPlace {
    id: string;
    name: string;
    /** Адрес страницы места; null — страница пока не показывается (published: false). */
    href: string | null;
    /** Стихи главы в канонической нумерации, где место названо. */
    verses: number[];
}

/**
 * Места главы — по подтверждённым упоминаниям в Писании. Места с латинским именем
 * (заведены импортом и русского имени ещё не получили) не показываются: английский
 * «Beth-arabah» среди славянского текста читатель не поймёт.
 */
const loadChapterPlaces = async (canonId: string, chapter: number): Promise<ChapterPlace[]> => {
    try {
        const rows = await (await db()).collection(PLACE_MENTIONS).aggregate([
            // Префикс в начале регулярки обслуживает индекс { canonRef: 1 }.
            { $match: { canonRef: { $regex: `^${escapeRegex(canonId)}\\.${chapter}\\.` }, status: "approved" } },
            { $group: { _id: "$placeId", refs: { $addToSet: "$canonRef" } } },
            { $lookup: { from: PLACES, localField: "_id", foreignField: "_id", as: "place",
                pipeline: [{ $project: { name: 1, alias: 1, slug: 1, published: 1 } }] } },
            { $unwind: "$place" },
        ]).toArray();

        return rows
            .filter((r) => /[а-яё]/i.test(r.place.name))
            .map((r) => ({
                id: String(r._id),
                name: r.place.name as string,
                href: r.place.published === false ? null : placeHref(r.place),
                verses: (r.refs as string[]).map((ref) => Number(ref.split(".").pop())).sort((a, b) => a - b),
            }))
            .sort((a, b) => a.verses[0] - b.verses[0] || a.name.localeCompare(b.name, "ru"));
    } catch (e) {
        reportError(e, { where: "lib/places/query#loadChapterPlaces" });
        return [];
    }
};

export const chapterPlaces = cached(loadChapterPlaces, ["chapter-places"], [CacheTag.PLACES]);

// --- Страница места

/** Место по адресу: слуг, прежний слуг, alias или идентификатор. Скрытые тоже — решает страница. */
const loadPlaceByAddress = async (address: string): Promise<any | null> => {
    try {
        const or: any[] = [{ slug: address }, { previousSlugs: address }, { alias: address }];
        if (ObjectId.isValid(address)) or.push({ _id: new ObjectId(address) });
        const row = await (await db()).collection(PLACES).findOne({ $or: or });
        return row ? { ...row, id: String(row._id), _id: undefined } : null;
    } catch (e) {
        reportError(e, { where: "lib/places/query#loadPlaceByAddress" });
        return null;
    }
};

export const getPlaceByAddress = cached(loadPlaceByAddress, ["place-by-address"], [CacheTag.PLACES]);

export interface RelatedPlace {
    id: string;
    name: string;
    href: string | null;
    kind?: PlaceKind;
    status?: PlaceStatus;
    location?: { coordinates: [number, number] };
}

export interface PlaceRelationView {
    direction: "out" | "in";
    type: RelationType;
    confidence: Confidence;
    score?: number;
    source: string;
    other: RelatedPlace;
}

const loadRelations = async (id: string): Promise<PlaceRelationView[]> => {
    try {
        const _id = new ObjectId(id);
        const rows = await (await db()).collection(PLACE_RELATIONS).aggregate([
            { $match: { $or: [{ from: _id }, { to: _id }] } },
            { $addFields: { direction: { $cond: [{ $eq: ["$from", _id] }, "out", "in"] },
                otherId: { $cond: [{ $eq: ["$from", _id] }, "$to", "$from"] } } },
            { $lookup: { from: PLACES, localField: "otherId", foreignField: "_id", as: "other",
                pipeline: [{ $project: { name: 1, slug: 1, alias: 1, published: 1, kind: 1, status: 1, location: 1 } }] } },
            { $unwind: "$other" },
        ]).toArray();

        // Соседа с латинским именем (Ancyra, Khirbet Ai) показываем как есть, без ссылки:
        // его страница скрыта, но спрятать саму связь значило бы оборвать цепочку
        // «Анкара ← Анкира» на полуслове.
        return rows
            .map((r) => ({
                direction: r.direction,
                type: r.type,
                confidence: r.confidence,
                ...(r.score !== undefined ? { score: r.score } : {}),
                source: r.source,
                other: {
                    id: String(r.other._id),
                    name: r.other.name,
                    href: r.other.published === false ? null : placeHref(r.other),
                    ...(r.other.kind ? { kind: r.other.kind } : {}),
                    ...(r.other.status ? { status: r.other.status } : {}),
                    ...(r.other.location ? { location: { coordinates: r.other.location.coordinates } } : {}),
                },
            }))
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.other.name.localeCompare(b.other.name, "ru"));
    } catch (e) {
        reportError(e, { where: "lib/places/query#loadRelations" });
        return [];
    }
};

export const placeRelations = cached(loadRelations, ["place-relations"], [CacheTag.PLACES]);

export interface ScriptureBook {
    canonId: string;
    name: string;
    verses: { canonRef: string; chapter: number; verse: number; context: string }[];
}

/** Подтверждённые упоминания в Писании — по книгам в порядке канона. */
const loadScripture = async (id: string): Promise<{ books: ScriptureBook[]; pending: number }> => {
    try {
        const coll = (await db()).collection(PLACE_MENTIONS);
        const [rows, pending] = await Promise.all([
            coll.find({ placeId: new ObjectId(id), corpus: "bible", status: "approved" },
                { projection: { canonRef: 1, canonSort: 1, context: 1 } }).toArray(),
            coll.countDocuments({ placeId: new ObjectId(id), corpus: "bible", status: "pending" }),
        ]);
        const books: ScriptureBook[] = [];
        for (const book of BIBLE_CANON) {
            const verses = rows
                .filter((r) => (r.canonRef as string).startsWith(`${book.id}.`))
                .sort((a, b) => a.canonSort - b.canonSort)
                .map((r) => {
                    const [, chapter, verse] = (r.canonRef as string).split(".");
                    return { canonRef: r.canonRef, chapter: Number(chapter), verse: Number(verse), context: r.context ?? "" };
                });
            if (verses.length) books.push({ canonId: book.id, name: book.name, verses });
        }
        return { books, pending };
    } catch (e) {
        reportError(e, { where: "lib/places/query#loadScripture" });
        return { books: [], pending: 0 };
    }
};

export const placeScripture = cached(loadScripture, ["place-scripture"], [CacheTag.PLACES]);

export interface PlaceText { id: string; alias?: string; name: string; book?: string }

/**
 * Тексты корпуса, где место помечено: разметкой `{pl|…}` (по идентификатору или
 * прежнему alias) и принятыми упоминаниями. Статьи энциклопедии Никифора о самом
 * месте сюда не идут — они показаны отдельно.
 */
const loadTexts = async (id: string, alias: string | undefined, articleAliases: string[]): Promise<PlaceText[]> => {
    try {
        const d = await db();
        const keys = [id, alias].filter(Boolean).map((k) => escapeRegex(k!));
        const mentioned = await d.collection(PLACE_MENTIONS)
            .find({ placeId: new ObjectId(id), corpus: "text", status: "approved" }, { projection: { textId: 1 } })
            .toArray();
        const texts = await d.collection("texts").aggregate([
            { $match: { $or: [
                { content: { $regex: `\\{pl\\|(${keys.join("|")})\\|` } },
                { _id: { $in: mentioned.map((m) => m.textId) } },
            ], alias: { $nin: articleAliases } } },
            { $project: { name: 1, alias: 1, bookId: 1 } },
            { $lookup: { from: "books", localField: "bookId", foreignField: "_id", as: "book", pipeline: [{ $project: { name: 1 } }] } },
            { $limit: 200 },
        ]).toArray();
        return texts.map((t) => ({ id: String(t._id), alias: t.alias, name: t.name, book: t.book?.[0]?.name }));
    } catch (e) {
        reportError(e, { where: "lib/places/query#loadTexts" });
        return [];
    }
};

export const placeTexts = cached(loadTexts, ["place-texts"], [CacheTag.PLACES, CacheTag.TEXTS]);

/** Статьи энциклопедии Никифора, сопоставленные с местом (ключи `nikifor`). */
const loadArticles = async (aliases: string[]): Promise<PlaceText[]> => {
    if (!aliases.length) return [];
    try {
        const rows = await (await db()).collection("texts")
            .find({ alias: { $in: aliases } }, { projection: { name: 1, alias: 1 } }).toArray();
        return rows.map((t) => ({ id: String(t._id), alias: t.alias, name: t.name }));
    } catch (e) {
        reportError(e, { where: "lib/places/query#loadArticles" });
        return [];
    }
};

export const placeArticles = cached(loadArticles, ["place-articles"], [CacheTag.PLACES, CacheTag.TEXTS]);

export interface NearbyTemple { slug: string; name: string; place?: string; distanceKm: number }

/** Храмы в двадцати километрах от точки места — из каталога храмов. */
const loadNearbyTemples = async (lon: number, lat: number): Promise<NearbyTemple[]> => {
    try {
        const rows = await (await db()).collection("temples").aggregate([
            // Отбор тот же, что у указателя храмов: без построек и неправославных
            // храмов — иначе «храмы рядом» у святого места звали бы в костёл.
            { $geoNear: { near: { type: "Point", coordinates: [lon, lat] }, distanceField: "distance", maxDistance: 20000, spherical: true, query: filterOf({}) } },
            { $limit: 8 },
            { $project: { slug: 1, name: 1, place: 1, distance: 1 } },
        ]).toArray();
        return rows.map((t) => ({ slug: t.slug, name: t.name, place: t.place, distanceKm: Math.round(t.distance / 100) / 10 }));
    } catch (e) {
        reportError(e, { where: "lib/places/query#loadNearbyTemples" });
        return [];
    }
};

export const nearbyTemples = cached(loadNearbyTemples, ["place-nearby-temples"], [CacheTag.PLACES, CacheTag.TEMPLES]);

// --- Места текста (блок «Связи» на странице чтения)

export interface TextPlace {
    id: string;
    name: string;
    href: string;
    /** Текст — статья энциклопедии об этом месте (ключ nikifor), а не упоминание в нём. */
    subject: boolean;
}

/**
 * Места текста: помеченные разметкой `{pl|id|…}`, найденные в нём и принятые на ревью,
 * и то место, о котором сам текст, если это статья энциклопедии Никифора (ключ
 * nikifor = алиас текста). Разметка ссылается то на идентификатор, то на прежний
 * alias — ищем по обоим.
 */
const loadTextPlaces = async (textId: string, content: string, alias?: string): Promise<TextPlace[]> => {
    try {
        const keys = [...new Set([...content.matchAll(/\{pl\|([^|}]+)\|/g)].map((m) => m[1]))];
        const d = await db();
        const mentioned = ObjectId.isValid(textId)
            ? await d.collection(PLACE_MENTIONS)
                .find({ textId: new ObjectId(textId), corpus: "text", status: "approved" }, { projection: { placeId: 1 } })
                .toArray()
            : [];
        if (!keys.length && !mentioned.length && !alias?.startsWith("nikifor-")) return [];
        const or: any[] = [{ alias: { $in: keys } }, { slug: { $in: keys } }, { _id: { $in: mentioned.map((m) => m.placeId) } }];
        const ids = keys.filter((k) => ObjectId.isValid(k)).map((k) => new ObjectId(k));
        if (ids.length) or.push({ _id: { $in: ids } });
        if (alias) or.push({ externals: { $elemMatch: { source: "nikifor", id: alias } } });
        const rows = await d.collection(PLACES)
            .find({ $or: or, published: { $ne: false } }, { projection: { name: 1, slug: 1, alias: 1, externals: 1 } })
            .toArray();
        return rows.map((r) => ({
            id: String(r._id),
            name: r.name,
            href: placeHref(r),
            subject: !!alias && (r.externals ?? []).some((e: any) => e.source === "nikifor" && e.id === alias),
        }))
            .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    } catch (e) {
        reportError(e, { where: "lib/places/query#loadTextPlaces" });
        return [];
    }
};

export const textPlaces = cached(loadTextPlaces, ["text-places"], [CacheTag.PLACES, CacheTag.TEXTS]);

// --- Указатель

export interface IndexPlace {
    id: string;
    name: string;
    href: string;
    /** Наш адрес места, если он выдан; по нему же место спрашивают наружу. */
    slug?: string;
    kind?: PlaceKind;
    status?: PlaceStatus;
    /** [долгота, широта]. */
    point?: [number, number];
    /** Подтверждённых упоминаний в Писании. */
    scripture: number;
    /** Имена места, приведённые для поиска, — см. `@/lib/places/search`. */
    haystack: string;
}

/** Точка места: из GeoJSON, а за его отсутствием — из прежних строковых полей. */
const pointOf = (row: any): [number, number] | null => {
    const coords = placeCoordinates(row);
    return coords ? [coords.longitude, coords.latitude] : null;
};

const loadIndex = async (): Promise<IndexPlace[]> => {
    try {
        const d = await db();
        const [rows, counts] = await Promise.all([
            d.collection(PLACES).find({ published: { $ne: false } },
                { projection: { name: 1, slug: 1, alias: 1, kind: 1, status: 1, location: 1,
                    latitude: 1, longitude: 1, names: 1, synonyms: 1 } }).toArray(),
            d.collection(PLACE_MENTIONS).aggregate([
                { $match: { corpus: "bible", status: "approved" } },
                { $group: { _id: "$placeId", n: { $sum: 1 } } },
            ]).toArray(),
        ]);
        const countOf = new Map(counts.map((c) => [String(c._id), c.n as number]));
        return rows
            .map((r) => ({
                id: String(r._id),
                name: r.name as string,
                href: placeHref(r),
                ...(r.slug ? { slug: r.slug as string } : {}),
                ...(r.kind ? { kind: r.kind } : {}),
                ...(r.status ? { status: r.status } : {}),
                // Точка — через placeCoordinates, а не прямо из location: у
                // записей, не прошедших миграцию, координаты лежат строками в
                // старых полях, и читая одно location, мы теряли бы их молча.
                ...(pointOf(r) ? { point: pointOf(r)! } : {}),
                scripture: countOf.get(String(r._id)) ?? 0,
                haystack: haystackOf(r as any),
            }))
            .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    } catch (e) {
        reportError(e, { where: "lib/places/query#loadIndex" });
        return [];
    }
};

export const placesIndex = cached(loadIndex, ["places-index"], [CacheTag.PLACES]);

// --- Святые и места
//
// Связь выводится, а не размечается: место названо в чтении, написанном к памяти
// святого (texts.dneslovId), и это упоминание принято. Это «упомянуто в житии», а не
// кафедра или родина: в житии названы и места, где святой не бывал. Так и подписано.

export interface SaintOfPlace {
    /** Ключ строки: ключ записи каталога или, для памяти вне каталога, номер святцев. */
    dneslovId: string;
    name: string;
    href: string;
    texts: number;
}

const loadSaintsOfPlace = async (id: string): Promise<SaintOfPlace[]> => {
    try {
        const rows = await (await db()).collection(PLACE_MENTIONS).aggregate([
            { $match: { placeId: new ObjectId(id), corpus: "text", status: "approved" } },
            { $lookup: { from: "texts", localField: "textId", foreignField: "_id", as: "text", pipeline: [{ $project: { dneslovId: 1, saintId: 1 } }] } },
            { $unwind: "$text" },
            // Святой текста — ключом каталога (@/lib/textSaints), номером — только
            // у текстов, чей святой в каталоге не нашёлся.
            { $project: { key: { $cond: [{ $in: ["$text.saintId", [null, ""]] }, { $concat: ["n:", { $ifNull: ["$text.dneslovId", ""] }] }, "$text.saintId"] } } },
            { $match: { key: { $nin: ["n:", null] } } },
            { $group: { _id: "$key", texts: { $sum: 1 } } },
        ]).toArray();
        const keys = rows.map((r) => String(r._id)).filter((k) => !k.startsWith("n:"));
        const numbers = rows.map((r) => String(r._id)).filter((k) => k.startsWith("n:")).map((k) => k.slice(2));
        if (!keys.length && !numbers.length) return [];
        const [cards, names, slugs] = await Promise.all([
            keys.length ? (await db()).collection("saints")
                .find({ _id: { $in: keys.filter((k) => ObjectId.isValid(k)).map((k) => new ObjectId(k)) } }, { projection: { name: 1, slug: 1 } })
                .toArray() : Promise.resolve([]),
            numbers.length ? saintNames(numbers) : Promise.resolve({} as Record<string, string>),
            numbers.length ? saintSlugs(numbers) : Promise.resolve({} as Record<string, string>),
        ]);
        const card = new Map((cards as any[]).map((c) => [String(c._id), c]));
        return rows
            .map((r) => {
                const key = String(r._id);
                if (key.startsWith("n:")) {
                    const n = key.slice(2);
                    return names[n] ? { dneslovId: n, name: names[n]!, href: `/saints/${slugs[n] ?? n}`, texts: r.texts } : null;
                }
                const c = card.get(key);
                return c?.name && c?.slug ? { dneslovId: key, name: c.name as string, href: `/saints/${c.slug}`, texts: r.texts } : null;
            })
            .filter((r): r is SaintOfPlace => !!r)
            .sort((a, b) => b.texts - a.texts || a.name.localeCompare(b.name, "ru"));
    } catch (e) {
        reportError(e, { where: "lib/places/query#loadSaintsOfPlace" });
        return [];
    }
};

export const saintsOfPlace = cached(loadSaintsOfPlace, ["place-saints"], [CacheTag.PLACES, CacheTag.SAINTS, CacheTag.TEXTS]);

export interface PlaceOfSaint { id: string; name: string; href: string; texts: number }

const loadPlacesOfSaint = async (saintId: string | null, dneslovIds: string[]): Promise<PlaceOfSaint[]> => {
    // Тексты святого — по ключу каталога и, для несверенных, по номеру святцев.
    const or: Record<string, unknown>[] = [];
    if (saintId) or.push({ saintId });
    if (dneslovIds.length) or.push({ dneslovId: { $in: dneslovIds } });
    if (!or.length) return [];
    try {
        const d = await db();
        const texts = await d.collection("texts").find({ $or: or }, { projection: { _id: 1 } }).toArray();
        if (!texts.length) return [];
        const rows = await d.collection(PLACE_MENTIONS).aggregate([
            { $match: { textId: { $in: texts.map((t) => t._id) }, corpus: "text", status: "approved" } },
            { $group: { _id: "$placeId", texts: { $sum: 1 } } },
            { $lookup: { from: PLACES, localField: "_id", foreignField: "_id", as: "place", pipeline: [{ $project: { name: 1, slug: 1, alias: 1, published: 1 } }] } },
            { $unwind: "$place" },
            { $match: { "place.published": { $ne: false } } },
        ]).toArray();
        return rows
            .map((r) => ({ id: String(r._id), name: r.place.name, href: placeHref(r.place), texts: r.texts }))
            .sort((a, b) => b.texts - a.texts || a.name.localeCompare(b.name, "ru"));
    } catch (e) {
        reportError(e, { where: "lib/places/query#loadPlacesOfSaint" });
        return [];
    }
};

export const placesOfSaint = cached(loadPlacesOfSaint, ["saint-places"], [CacheTag.PLACES, CacheTag.TEXTS]);

// --- Карта славянских поселений

export interface SlavicPoint { id: string; name: string; href: string; lon: number; lat: number; from?: number; label: string }
export interface SlavicRoute { id: string; name: string; href: string; coordinates: [number, number][] }

const loadSlavic = async (): Promise<{ points: SlavicPoint[]; routes: SlavicRoute[] }> => {
    try {
        const rows = await (await db()).collection(PLACES).find(
            { collections: "slavic", published: { $ne: false } },
            { projection: { name: 1, slug: 1, alias: 1, location: 1, line: 1, periods: 1 } },
        ).toArray();
        const points: SlavicPoint[] = [];
        const routes: SlavicRoute[] = [];
        for (const r of rows) {
            if (r.line) {
                routes.push({ id: String(r._id), name: r.name, href: placeHref(r), coordinates: r.line.coordinates });
                continue;
            }
            if (!r.location) continue;
            const period = (r.periods ?? []).find((p: any) => p.source === "slavic-map");
            const span = period ? spanLabel(period.from, period.to) : "";
            points.push({
                id: String(r._id), name: r.name, href: placeHref(r),
                lon: r.location.coordinates[0], lat: r.location.coordinates[1],
                ...(period?.from !== undefined ? { from: period.from } : {}),
                label: span ? `${r.name} (${span})` : r.name,
            });
        }
        return { points, routes };
    } catch (e) {
        reportError(e, { where: "lib/places/query#loadSlavic" });
        return { points: [], routes: [] };
    }
};

export const slavicPlaces = cached(loadSlavic, ["places-slavic"], [CacheTag.PLACES]);
