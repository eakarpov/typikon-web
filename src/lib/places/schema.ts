// Модель места. Коллекции Mongo, база `typikon`:
//
//   places           — место: имена по эпохам, точка, периоды, внешние ключи;
//   place_relations  — направленные связи между местами (преемственность,
//                      вложенность, отождествление) с достоверностью;
//   place_mentions   — упоминания места в Писании, текстах корпуса и песнопениях,
//                      вместе с кандидатами на ревью (поле status).
//
// Модель расширяет прежнюю коллекцию, а не заменяет её: `_id` и `alias` остаются,
// пометка `{pl|id|…}` в текстах и /api/v2/places/{id} продолжают работать.
import type { ObjectId } from "mongodb";

export const PLACES = "places";
export const PLACE_RELATIONS = "place_relations";
export const PLACE_MENTIONS = "place_mentions";

export type PlaceKind =
    | "settlement" | "region" | "mountain" | "river" | "sea" | "lake"
    | "valley" | "spring" | "desert" | "island" | "monastery" | "building" | "route" | "other";

/** Существует ли место: город живёт, от города руины, место утрачено, отождествление не установлено. */
export type PlaceStatus = "extant" | "ruins" | "lost" | "uncertain";

export type NameRole = "modern" | "biblical" | "historical" | "slavonic" | "variant";

export type PlaceSource = "wikidata" | "pleiades" | "openbible" | "nikifor" | "editor";

export interface PlaceName {
    /** Имя в своём письме: «Ἄγκυρα», «ⲣⲁⲕⲟⲧⲉ». */
    name: string;
    /** Латинская транслитерация, если имя записано не латиницей: «Ankyra». */
    transliteration?: string;
    /** Код языка: ru, csl, grc, heb, lat, ar, tr… */
    lang: string;
    role: NameRole;
    /** Годы действия имени; до Р. Х. — отрицательные. */
    from?: number;
    to?: number;
    source: PlaceSource;
}

export interface PlaceLocation {
    type: "Point";
    /** [долгота, широта] — порядок GeoJSON. */
    coordinates: [number, number];
}

export interface PlacePeriod {
    from?: number;
    to?: number;
    label: string;
    note?: string;
    source: PlaceSource;
}

export interface PlaceExternal {
    source: Exclude<PlaceSource, "editor">;
    id: string;
}

export interface Place {
    _id: ObjectId;
    /** Адрес страницы; выдаётся один раз и больше не меняется. */
    slug?: string;
    previousSlugs?: string[];
    /** Прежний адрес; на него ссылаются пометки в текстах. */
    alias?: string;
    name: string;
    /**
     * Откуда основное имя. Имя от редактора и от энциклопедии Никифора обогащение
     * не перезаписывает; имя импорта (английское) заменяется русским из Wikidata.
     * Отсутствие поля у записей, заведённых руками, значит «редактор».
     */
    nameSource?: PlaceSource;
    kind?: PlaceKind;
    status?: PlaceStatus;
    names?: PlaceName[];
    location?: PlaceLocation;
    /** Откуда точка: поставленную редактором импорт не перезаписывает. */
    locationSource?: PlaceSource;
    precision?: "exact" | "approx" | "area";
    /**
     * Показывается ли страница. Импорт заводит места скрытыми: у них пока нет
     * русского имени, а страница с английским заголовком хуже, чем никакой.
     * Отсутствие поля — показывается (так у мест, заведённых руками).
     */
    published?: boolean;
    periods?: PlacePeriod[];
    externals?: PlaceExternal[];
    description?: string;
    links?: { url: string; text: string }[];
    /** Прежние поля; выводятся в names/location, см. @/lib/places/legacy. */
    synonyms?: string[];
    latitude?: string;
    longitude?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export type RelationType = "succeeds" | "part_of" | "located_in" | "identified_with" | "near";
export type Confidence = "certain" | "probable" | "disputed";

export interface PlaceRelation {
    _id?: ObjectId;
    from: ObjectId;
    to: ObjectId;
    type: RelationType;
    confidence: Confidence;
    /** Балл источника (у OpenBible — от 0 до 1000), если он есть. */
    score?: number;
    /** Годы действия связи. */
    fromYear?: number;
    toYear?: number;
    source: PlaceSource;
    note?: string;
}

export type MentionCorpus = "bible" | "text" | "chant";
export type MentionMethod = "openbible" | "markup" | "matcher" | "manual";
export type MentionStatus = "approved" | "pending" | "rejected";

export interface PlaceMention {
    _id?: ObjectId;
    placeId: ObjectId;
    corpus: MentionCorpus;
    canonRef?: string;
    canonSort?: number;
    textId?: ObjectId;
    chantRef?: string;
    word?: string;
    context?: string;
    method: MentionMethod;
    status: MentionStatus;
    reviewedAt?: Date;
}
