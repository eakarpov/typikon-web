// Разбор данных OpenBible Bible Geocoding (CC BY 4.0,
// https://github.com/openbibleinfo/Bible-Geocoding-Data) в модель мест.
//
// В ИСТОЧНИКЕ ДВА РОДА ЗАПИСЕЙ. Древнее место (ancient.jsonl, id на «a») — то, что
// названо в тексте Писания, со списком стихов. Современная точка (modern.jsonl, id на
// «m») — где это место ищут сегодня. Одному древнему месту сопоставлено от нуля до
// тридцати трёх точек, каждой с баллом 0–1000; балл — доля уверенности текущей
// науки (500 — «пятьдесят на пятьдесят»), так что кандидаты одного места в сумме
// тысячи не превышают.
//
// ОДНА ЗАПИСЬ, КОГДА ЭТО ОДНО МЕСТО. Если у древнего места и у его лучшего кандидата
// один и тот же QID Wikidata (Вифлеем и нынешний Вифлеем), это не отождествление, а
// одно поселение, дожившее до нас. Такие пары сводятся в одну запись; остальные
// кандидаты остаются отдельными местами со связью `identified_with`.
//
// Чистые функции без базы: разбор проверяется тестом, запись — в скрипте
// src/scripts/places/import-openbible.ts.
import type { Confidence, PlaceExternal, PlaceKind, PlaceLocation, PlaceName, PlaceStatus, RelationType } from "@/lib/places/schema";

// Ключи источников внутри linked_data (source.jsonl).
const WIKIDATA = "s7cc8b2";
const PLEIADES = "s2428ed";

export interface ObVerse { osis: string; readable?: string; sort?: string; instance_types?: Record<string, number> }
export interface ObScore { time_total?: number }
export interface ObIdentification { id: string; id_source: "modern" | "ancient" | "special"; description: string; score?: ObScore }
export interface ObAncient {
    id: string;
    friendly_id: string;
    types?: string[];
    identifications?: ObIdentification[];
    linked_data?: Record<string, { id?: string; modifier?: string }>;
    modern_associations?: Record<string, { name: string; score: number }>;
    translation_name_counts?: Record<string, number>;
    verses?: ObVerse[];
}
export interface ObModern {
    id: string;
    friendly_id: string;
    type?: string;
    lonlat?: string;
    names?: { name: string; type: "modern" | "ancient"; typo_for?: string }[];
    precision?: { type?: string; meters?: number };
    coordinates_source?: { type?: string; id?: string };
    root?: { id: string; modifier?: string; source: string };
}

/** Балл кандидата в достоверность. Ниже 100 (меньше десятой доли уверенности) связь не заводится. */
export const confidenceOf = (score: number | undefined): Confidence | null => {
    if (score === undefined || score < 100) return null;
    if (score >= 800) return "certain";
    if (score >= 300) return "probable";
    return "disputed";
};

export const kindOf = (type: string | undefined): PlaceKind => {
    switch (type) {
        case "settlement": case "campsite": return "settlement";
        case "region": case "natural area": case "people group": case "field": case "forest": return "region";
        case "mountain": case "mountain range": case "hill": case "cliff": case "promontory": return "mountain";
        case "river": case "wadi": case "mouth of river": return "river";
        case "spring": case "well": case "pool": return "spring";
        case "body of water": return "lake";
        case "valley": return "valley";
        case "island": case "archipelago": return "island";
        case "structure": case "gate": case "wall": case "tower": case "cave": return "building";
        case "road": return "route";
        default: return "other";
    }
};

/**
 * Точность точки по оценке источника в метрах. Холм-телль или дом — до полукилометра;
 * посёлок и окрестность — до пяти; дальше это уже «где-то в этой области».
 */
export const precisionOf = (meters: number | undefined, type: string | undefined): "exact" | "approx" | "area" => {
    if (type === "region" || type === "terrain") return "area";
    if (meters === undefined) return "approx";
    if (meters <= 500) return "exact";
    if (meters <= 5000) return "approx";
    return "area";
};

/** Состояние по тому, что стоит на точке сегодня: телль — руины, живой посёлок — существует. */
export const statusOfModern = (m: ObModern): PlaceStatus | undefined => {
    if (m.precision?.type === "tel") return "ruins";
    if (m.precision?.type === "settlement") return "extant";
    return undefined;
};

export const parseLonLat = (value: string | undefined): PlaceLocation | null => {
    const [lon, lat] = (value ?? "").split(",").map(Number);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { type: "Point", coordinates: [lon, lat] };
};

/**
 * Связь древнего места с другим древним — по описанию отождествления. Шаблонов в
 * источнике немного: «another name for X», «in X», «within 5 km of X»; «X» без
 * оборота значит то же, что «another name for».
 */
export const ancientRelationOf = (description: string): RelationType | null => {
    const template = description.replace(/<ancient id="[^"]+">[^<]*<\/ancient>/g, "<A>").trim();
    if (/^(another name for (the )?)?<A>$/.test(template)) return "identified_with";
    if (/^(in|on|along)( the)? <A>$/.test(template)) return "located_in";
    if (/^(within|about) .+ (of|around)( the)? <A>$|^region around <A>$/.test(template)) return "near";
    return null;
};

/** «not a place (person)», «not a proper name (common noun for ruin)» — не место вовсе. */
const isNotAPlace = (i: ObIdentification) => i.id_source === "special" && /^not a (place|proper name)/.test(i.description);

/** «Bethlehem 1» → «Bethlehem»: номер у источника разводит одноимённые места, в имени он не нужен. */
export const displayName = (friendlyId: string) => friendlyId.replace(/\s+\d+$/, "");

export interface PlanPlace {
    /** Идентификаторы OpenBible, сведённые в эту запись: древнее место и, быть может, его точка. */
    keys: string[];
    name: string;
    kind: PlaceKind;
    status?: PlaceStatus;
    names: PlaceName[];
    location?: PlaceLocation;
    precision?: "exact" | "approx" | "area";
    externals: PlaceExternal[];
}
export interface PlanRelation { from: string; to: string; type: RelationType; confidence: Confidence; score?: number }
export interface PlanVerse { key: string; osis: string; readable?: string; sort?: string; instanceTypes?: Record<string, number> }

export interface Plan {
    places: PlanPlace[];
    relations: PlanRelation[];
    verses: PlanVerse[];
    report: {
        ancient: number;
        modern: number;
        merged: number;
        notAPlace: string[];
        lowScoreDropped: number;
        unusedModern: number;
        qidConflicts: string[];
    };
}

const wikidataOfAncient = (a: ObAncient): string | undefined => {
    const link = a.linked_data?.[WIKIDATA];
    // modifier «modern» — элемент о нынешнем месте, «not» — вовсе не о нём.
    return link?.id && !link.modifier ? link.id : undefined;
};
const wikidataOfModern = (m: ObModern) => m.coordinates_source?.type === "wikidata" ? m.coordinates_source.id : undefined;

const bestAssociation = (a: ObAncient) =>
    Object.entries(a.modern_associations ?? {}).sort((x, y) => y[1].score - x[1].score || x[0].localeCompare(y[0]))[0];

export const buildPlan = (ancients: ObAncient[], moderns: ObModern[]): Plan => {
    const modernById = new Map(moderns.map((m) => [m.id, m]));
    const report: Plan["report"] = { ancient: 0, modern: 0, merged: 0, notAPlace: [], lowScoreDropped: 0, unusedModern: 0, qidConflicts: [] };

    // Не место: все отождествления — «not a place». Смешанные («Ai 2»: и нарицательное
    // «развалины», и две точки) остаются — решает ревью.
    const kept = ancients.filter((a) => {
        const ids = a.identifications ?? [];
        const skip = ids.length > 0 && ids.every(isNotAPlace);
        if (skip) report.notAPlace.push(a.friendly_id);
        return !skip;
    });
    const keptIds = new Set(kept.map((a) => a.id));

    // Какие точки войдут: те, что хоть одному месту сопоставлены с баллом от 100.
    const usedModern = new Set<string>();
    for (const a of kept) {
        for (const [mid, assoc] of Object.entries(a.modern_associations ?? {})) {
            if (confidenceOf(assoc.score) && modernById.has(mid)) usedModern.add(mid);
            else report.lowScoreDropped++;
        }
    }
    report.unusedModern = moderns.length - usedModern.size;

    // Сведение древнего места с точкой при общем QID. Порог — «вероятно», а не
    // «несомненно»: общий элемент Wikidata сам по себе говорит, что это одно место,
    // а балл лишь подтверждает, что точка у места лучшая (Вефиль и Бейтин — 716).
    // Если общий QID у точки, которая лучшей не стала, ключ остаётся древнему месту.
    const recordOf = new Map<string, string>(); // id OpenBible → ключ записи (id древнего места или точки)
    const mergedModern = new Map<string, string>(); // id точки → id древнего места
    for (const a of kept) {
        const qid = wikidataOfAncient(a);
        const best = bestAssociation(a);
        if (!qid || !best || best[1].score < 300) continue;
        const m = modernById.get(best[0]);
        if (m && wikidataOfModern(m) === qid && !mergedModern.has(m.id)) {
            mergedModern.set(m.id, a.id);
        }
    }
    report.merged = mergedModern.size;

    const places = new Map<string, PlanPlace>();

    for (const a of kept) {
        const names: PlaceName[] = Object.entries(a.translation_name_counts ?? {})
            .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
            .map(([name]) => ({ name, lang: "en", role: "biblical" as const, source: "openbible" as const }));
        const externals: PlaceExternal[] = [{ source: "openbible", id: a.id }];
        const qid = wikidataOfAncient(a);
        if (qid) externals.push({ source: "wikidata", id: qid });
        const pleiades = a.linked_data?.[PLEIADES]?.id;
        if (pleiades) externals.push({ source: "pleiades", id: pleiades });

        const best = bestAssociation(a);
        const place: PlanPlace = {
            keys: [a.id],
            name: displayName(a.friendly_id),
            kind: kindOf(a.types?.[0]),
            names,
            externals,
            ...(!best || best[1].score < 300 ? { status: "uncertain" as const } : {}),
        };
        places.set(a.id, place);
        recordOf.set(a.id, a.id);
        report.ancient++;
    }

    for (const m of moderns) {
        if (!usedModern.has(m.id)) continue;
        const location = parseLonLat(m.lonlat);
        const names: PlaceName[] = (m.names ?? [])
            .filter((n) => !n.typo_for)
            .map((n) => ({ name: n.name, lang: "en", role: n.type === "ancient" ? "historical" as const : "modern" as const, source: "openbible" as const }));
        const externals: PlaceExternal[] = [{ source: "openbible", id: m.id }];
        const qid = wikidataOfModern(m);
        if (m.coordinates_source?.type === "pleiades" && m.coordinates_source.id) {
            externals.push({ source: "pleiades", id: m.coordinates_source.id });
        }
        const status = statusOfModern(m);
        const precision = location ? precisionOf(m.precision?.meters, m.precision?.type) : undefined;

        const into = mergedModern.get(m.id);
        if (into) {
            const place = places.get(into)!;
            place.keys.push(m.id);
            place.names.push(...names.filter((n) => !place.names.some((p) => p.name === n.name)));
            place.externals.push(...externals.filter((e) => e.source !== "wikidata"));
            if (location) { place.location = location; place.precision = precision; }
            if (status) place.status = status;
            else delete place.status;
            recordOf.set(m.id, into);
            continue;
        }
        if (qid) externals.push({ source: "wikidata", id: qid });
        places.set(m.id, {
            keys: [m.id],
            name: m.friendly_id,
            kind: kindOf(m.type),
            names,
            externals,
            ...(location ? { location, precision } : {}),
            ...(status ? { status } : {}),
        });
        recordOf.set(m.id, m.id);
        report.modern++;
    }

    // Внешний ключ у двух записей — уникальный индекс не примет вторую. Оставляем
    // первой по порядку id, остальным снимаем и называем в отчёте.
    const claimed = new Map<string, string>();
    for (const place of [...places.values()].sort((x, y) => x.keys[0].localeCompare(y.keys[0]))) {
        place.externals = place.externals.filter((e) => {
            const key = `${e.source}:${e.id}`;
            const owner = claimed.get(key);
            if (owner && owner !== place.keys[0]) {
                report.qidConflicts.push(`${key}: ${owner} и ${place.keys[0]}`);
                return false;
            }
            claimed.set(key, place.keys[0]);
            return true;
        });
    }

    // Связи: к точкам — по баллам сопоставления, между древними — по описанию.
    const relations = new Map<string, PlanRelation>();
    const addRelation = (r: PlanRelation) => {
        if (r.from === r.to) return;
        const key = `${r.from}>${r.to}>${r.type}`;
        const prev = relations.get(key);
        if (!prev || (r.score ?? 0) > (prev.score ?? 0)) relations.set(key, r);
    };
    for (const a of kept) {
        const from = recordOf.get(a.id)!;
        for (const [mid, assoc] of Object.entries(a.modern_associations ?? {})) {
            const confidence = confidenceOf(assoc.score);
            const to = recordOf.get(mid);
            if (confidence && to) addRelation({ from, to, type: "identified_with", confidence, score: assoc.score });
        }
        for (const i of a.identifications ?? []) {
            if (i.id_source !== "ancient" || !keptIds.has(i.id)) continue;
            const type = ancientRelationOf(i.description);
            const confidence = confidenceOf(i.score?.time_total);
            if (type && confidence) addRelation({ from, to: recordOf.get(i.id)!, type, confidence, score: i.score?.time_total });
        }
    }

    const verses: PlanVerse[] = kept.flatMap((a) => (a.verses ?? []).map((v) => ({
        key: a.id,
        osis: v.osis,
        readable: v.readable,
        sort: v.sort,
        instanceTypes: v.instance_types,
    })));

    return { places: [...places.values()], relations: [...relations.values()], verses, report };
};
