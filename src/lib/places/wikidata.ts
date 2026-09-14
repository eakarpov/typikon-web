// Обогащение мест из Wikidata (CC0): имена по эпохам, точка, ключ Pleiades и
// связи преемственности «заменяет / заменён на» (P1365 / P1366).
//
// Чистые функции: сведения об элементе собираются из строк ответа SPARQL в
// `WikidataFacts`, а из фактов и текущей записи выводится обновление. Запросы и
// запись — в src/scripts/places/enrich-wikidata.ts.
//
// РОЛЬ ИМЕНИ ЗАВИСИТ ОТ ЗАПИСИ. Русская метка элемента о древнем месте («Вефиль»)
// — историческое имя, о живом городе («Анкара») — современное. Библейскую форму
// дадут не отсюда, а из энциклопедии Никифора. Официальное название с датой конца
// (P1448 + P582: «Angora» до 1930) — историческое при любой записи.
import { extractYearFromIso } from "@/scripts/lib/wikidataDate";
import type { NameRole, PlaceLocation, PlaceName, PlaceStatus } from "@/lib/places/schema";

export interface DatedName { name: string; lang: string; from?: number; to?: number }

export interface WikidataFacts {
    qid: string;
    labelRu?: string;
    labelEn?: string;
    aliasesRu: string[];
    officialNames: DatedName[];
    nativeNames: DatedName[];
    location?: PlaceLocation;
    pleiades?: string;
    dissolved?: number;
    /** Элементы, которые это место заменило (P1365): оно им преемник. */
    replaces: string[];
    /** Элементы, которыми это место заменено (P1366). */
    replacedBy: string[];
}

export const emptyFacts = (qid: string): WikidataFacts => ({
    qid, aliasesRu: [], officialNames: [], nativeNames: [], replaces: [], replacedBy: [],
});

/** Строка ответа SPARQL (тот же вид, что в @/scripts/lib/wikidata). */
export type SparqlRow = Record<string, { value: string; "xml:lang"?: string } | undefined>;

const qidOfUri = (uri: string | undefined) => uri?.split("/").pop();

/**
 * Факты из двух ответов: скалярного (метки, точка, Pleiades, упразднение) и
 * списочного, где у каждой строки `kind` — alias | official | native | replaces |
 * replacedBy. Разнесено на два запроса нарочно: в одном OPTIONAL по спискам
 * перемножили бы строки.
 */
export const factsFromRows = (scalar: SparqlRow[], lists: SparqlRow[]): Map<string, WikidataFacts> => {
    const facts = new Map<string, WikidataFacts>();
    const of = (row: SparqlRow) => {
        const qid = qidOfUri(row.item?.value)!;
        if (!facts.has(qid)) facts.set(qid, emptyFacts(qid));
        return facts.get(qid)!;
    };
    for (const row of scalar) {
        const f = of(row);
        f.labelRu ??= row.labelRu?.value;
        f.labelEn ??= row.labelEn?.value;
        f.location ??= parseWktPoint(row.coord?.value);
        f.pleiades ??= row.pleiades?.value;
        f.dissolved ??= yearOf(row.dissolved?.value);
    }
    for (const row of lists) {
        const f = of(row);
        const value = row.value?.value;
        if (!value) continue;
        switch (row.kind?.value) {
            case "alias":
                if (!f.aliasesRu.includes(value)) f.aliasesRu.push(value);
                break;
            case "official":
            case "native": {
                const item: DatedName = {
                    name: value,
                    lang: row.value?.["xml:lang"] ?? "und",
                    ...(row.start ? { from: yearOf(row.start.value) } : {}),
                    ...(row.end ? { to: yearOf(row.end.value) } : {}),
                };
                pushUnique(row.kind.value === "official" ? f.officialNames : f.nativeNames, item);
                break;
            }
            case "replaces":
            case "replacedBy": {
                const target = qidOfUri(value)!;
                const list = row.kind.value === "replaces" ? f.replaces : f.replacedBy;
                if (!list.includes(target)) list.push(target);
                break;
            }
        }
    }
    return facts;
};

/**
 * Связи преемственности из фактов: «A заменяет B» и «B заменён на A» — одна и та
 * же связь «A — преемник B». Пара приводится к виду [преемник, предшественник].
 */
export const successionPairs = (all: Iterable<WikidataFacts>): [string, string][] => {
    const pairs = new Map<string, [string, string]>();
    for (const f of all) {
        for (const older of f.replaces) pairs.set(`${f.qid}>${older}`, [f.qid, older]);
        for (const newer of f.replacedBy) pairs.set(`${newer}>${f.qid}`, [newer, f.qid]);
    }
    return [...pairs.values()].filter(([a, b]) => a !== b);
};

/** «Point(32.85 39.93)» → точка GeoJSON. */
export const parseWktPoint = (wkt: string | undefined): PlaceLocation | undefined => {
    const m = wkt?.match(/^Point\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)$/);
    if (!m) return undefined;
    const lon = Number(m[1]), lat = Number(m[2]);
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
    return { type: "Point", coordinates: [lon, lat] };
};

export const yearOf = (iso: string | undefined) => (iso ? extractYearFromIso(iso) : undefined);

const pushUnique = (list: DatedName[], item: DatedName) => {
    if (!list.some((n) => n.name === item.name && n.lang === item.lang && n.from === item.from && n.to === item.to)) list.push(item);
};

/**
 * Имена из фактов. `ancient` — запись о месте, известном только по древности
 * (ключ OpenBible на «a» без сведённой точки): его метки — исторические имена.
 */
export const namesFromFacts = (facts: WikidataFacts, ancient: boolean): PlaceName[] => {
    const labelRole: NameRole = ancient ? "historical" : "modern";
    const names: PlaceName[] = [];
    const add = (name: string | undefined, lang: string, role: NameRole, from?: number, to?: number) => {
        const value = name?.trim();
        if (!value) return;
        if (names.some((n) => n.name === value && n.lang === lang)) return;
        names.push({ name: value, lang, role, source: "wikidata", ...(from !== undefined ? { from } : {}), ...(to !== undefined ? { to } : {}) });
    };
    add(facts.labelRu, "ru", labelRole);
    // Английская метка — не для показа, а чтобы у записи без русского имени
    // (Ancyra) список имён не был пуст: по нему её найдёт и сопоставит Никифор.
    add(facts.labelEn, "en", labelRole);
    for (const n of facts.officialNames) add(n.name, n.lang, n.to !== undefined ? "historical" : labelRole, n.from, n.to);
    for (const n of facts.nativeNames) add(n.name, n.lang, labelRole, n.from, n.to);
    for (const alias of facts.aliasesRu) add(alias, "ru", "variant");
    return names;
};

export interface EnrichTarget {
    name: string;
    nameSource?: string;
    names?: PlaceName[];
    location?: PlaceLocation;
    locationSource?: string;
    status?: PlaceStatus;
    externals?: { source: string; id: string }[];
    ancient: boolean;
    /**
     * У места есть преемник на том же месте (Константинополь → Стамбул). Тогда дата
     * упразднения (P576) — смена имени и власти, а не разрушение, и руинами место не
     * называется.
     */
    hasSuccessor?: boolean;
}

export interface EnrichUpdate {
    name?: string;
    nameSource?: "wikidata";
    names: PlaceName[];
    location?: PlaceLocation;
    locationSource?: "wikidata";
    status?: PlaceStatus;
    pleiades?: string;
}

/**
 * Обновление записи по фактам. Чужое не трогается: имена других источников
 * остаются, свои (source: wikidata) заменяются; точку ставим, только если её нет;
 * основное имя меняем, только если оно пришло из импорта OpenBible.
 */
export const enrichUpdate = (target: EnrichTarget, facts: WikidataFacts): EnrichUpdate => {
    const names = [...(target.names ?? []).filter((n) => n.source !== "wikidata"), ...namesFromFacts(facts, target.ancient)];
    const update: EnrichUpdate = { names };
    if (facts.labelRu && target.nameSource === "openbible") {
        update.name = facts.labelRu;
        update.nameSource = "wikidata";
    }
    if (facts.location && !target.location) {
        update.location = facts.location;
        update.locationSource = "wikidata";
    }
    if (facts.dissolved !== undefined && !target.status && !target.hasSuccessor) update.status = "ruins";
    if (facts.pleiades && !(target.externals ?? []).some((e) => e.source === "pleiades")) update.pleiades = facts.pleiades;
    return update;
};
