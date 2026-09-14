// Места: обогащение из Wikidata (CC0). Этап 1, шаг 2 — после import-openbible.
//
// Что делает, по порядку:
//
//  1. Места, заведённые руками, получают QID по своим ссылкам на Википедию
//     (schema:about). Если этот QID уже у другой записи — это дубль ручной и
//     импортированной записи; он называется в отчёте и не сводится сам.
//  2. По всем QID собираются факты (@/lib/places/wikidata): русская метка и
//     синонимы, официальные и самоназвания с годами, точка, ключ Pleiades,
//     упразднение, «заменяет / заменён на».
//  3. Записи обновляются: имена из Wikidata заменяются целиком, чужие остаются;
//     английское имя импорта уступает русской метке; точка ставится, только если
//     её не было.
//  4. Предшественники и преемники, которых в базе нет (Анкира у Анкары), заводятся
//     скрытыми записями — на один шаг, без обхода дальше. Связи `succeeds` с
//     source: "wikidata" пересобираются целиком.
//
// Запуск:  npm run places:enrich-wikidata            # отчёт, ничего не пишет
//          npm run places:enrich-wikidata -- --write # записать
import "@/scripts/lib/env";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { chunks, qidOf, sparql } from "@/scripts/lib/wikidata";
import { enrichUpdate, factsFromRows, namesFromFacts, successionPairs, WikidataFacts } from "@/lib/places/wikidata";
import { PLACE_RELATIONS, PLACES } from "@/lib/places/schema";

const WRITE = process.argv.includes("--write");
const BATCH = 150;

const values = (qids: string[]) => qids.map((q) => `wd:${q}`).join(" ");

const scalarQuery = (qids: string[]) => `
SELECT ?item ?labelRu ?labelEn ?coord ?pleiades ?dissolved WHERE {
  VALUES ?item { ${values(qids)} }
  OPTIONAL { ?item rdfs:label ?labelRu . FILTER(lang(?labelRu) = "ru") }
  OPTIONAL { ?item rdfs:label ?labelEn . FILTER(lang(?labelEn) = "en") }
  OPTIONAL { ?item wdt:P625 ?coord }
  OPTIONAL { ?item wdt:P1584 ?pleiades }
  OPTIONAL { ?item wdt:P576 ?dissolved }
}`;

const listQuery = (qids: string[]) => `
SELECT ?item ?kind ?value ?start ?end WHERE {
  VALUES ?item { ${values(qids)} }
  { ?item skos:altLabel ?value . FILTER(lang(?value) = "ru") BIND("alias" AS ?kind) }
  UNION { ?item p:P1448 ?st . ?st ps:P1448 ?value .
          OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end } BIND("official" AS ?kind) }
  UNION { ?item wdt:P1705 ?value . BIND("native" AS ?kind) }
  UNION { ?item wdt:P1365 ?value . BIND("replaces" AS ?kind) }
  UNION { ?item wdt:P1366 ?value . BIND("replacedBy" AS ?kind) }
}`;

const fetchFacts = async (qids: string[]): Promise<Map<string, WikidataFacts>> => {
    const scalar = [], lists = [];
    for (const [i, part] of chunks(qids, BATCH).entries()) {
        console.log(`  факты: пачка ${i + 1} из ${Math.ceil(qids.length / BATCH)}`);
        scalar.push(...await sparql(scalarQuery(part)));
        lists.push(...await sparql(listQuery(part)));
    }
    return factsFromRows(scalar, lists);
};

/** Адрес статьи в том написании, в каком его хранит Wikidata: подчёркивания и процентная кодировка. */
const articleUri = (url: string) => {
    const m = url.match(/^https?:\/\/([a-z-]+\.wikipedia\.org)\/wiki\/(.+)$/);
    if (!m) return null;
    const title = decodeURIComponent(m[2]).replace(/ /g, "_");
    return `https://${m[1]}/wiki/${encodeURIComponent(title).replace(/%2F/g, "/").replace(/%3A/g, ":")}`;
};

const wikidataOf = (row: any) => row.externals?.find((e: any) => e.source === "wikidata")?.id as string | undefined;
const isAncient = (row: any) => {
    const ob = (row.externals ?? []).filter((e: any) => e.source === "openbible").map((e: any) => e.id as string);
    return ob.length > 0 && ob.every((id: string) => id.startsWith("a"));
};

async function main() {
    const db = (await clientPromise).db("typikon");
    const places = db.collection(PLACES);
    const now = new Date();

    // 1. Ручные записи без QID — по ссылкам на Википедию.
    const rows = await places.find({}, { projection: { name: 1, nameSource: 1, names: 1, location: 1, locationSource: 1, status: 1, externals: 1, links: 1, published: 1, kind: 1, origin: 1 } }).toArray();
    const byQid = new Map<string, any>();
    for (const row of rows) { const q = wikidataOf(row); if (q) byQid.set(q, row); }

    const manual = rows.filter((r) => r.published !== false && !wikidataOf(r));
    const articles = new Map<string, any>();
    for (const row of manual) {
        for (const link of row.links ?? []) {
            const uri = articleUri(link.url ?? "");
            if (uri) articles.set(uri, row);
        }
    }
    const resolved: string[] = [], duplicates: string[] = [];
    const resolvedRows = new Set<string>();
    if (articles.size) {
        const found = await sparql(`SELECT ?article ?item WHERE { VALUES ?article { ${[...articles.keys()].map((a) => `<${a}>`).join(" ")} } ?article schema:about ?item }`);
        for (const r of found) {
            const row = articles.get(r.article!.value);
            const qid = qidOf(r.item?.value);
            if (!row || !qid || wikidataOf(row)) continue;
            const other = byQid.get(qid);
            if (other) {
                duplicates.push(`${row.name} и ${other.name} (${qid})`);
                continue;
            }
            byQid.set(qid, row);
            resolvedRows.add(String(row._id));
            resolved.push(`${row.name} → ${qid}`);
        }
    }

    // 2. Факты по всем QID.
    const facts = await fetchFacts([...byQid.keys()]);

    // 4 (сбор). Предшественники и преемники, которых в базе нет.
    //
    // ОДИН ШАГ, А НЕ ОБХОД. Пара берётся, только если одна её сторона — «своя»
    // запись: из OpenBible или заведённая руками. Иначе заведённые этим же скриптом
    // соседи на следующем прогоне приводили бы своих соседей, и каждый прогон
    // уходил бы на шаг дальше от Писания (Ханаан → Урарту → …).
    //
    // «Своя» — любая запись, кроме заведённой этим же скриптом как сосед (origin:
    // wikidata-neighbor). Прежний признак «открыта или из OpenBible» перестал работать,
    // как только адреса открыли и соседей: на следующем прогоне они сами стали «своими»
    // и привели 24 соседа второго шага (исправлено 2026-09-15).
    const core = new Set<string>();
    for (const [qid, row] of byQid) {
        if (row.origin !== "wikidata-neighbor") core.add(qid);
    }
    const pairs = successionPairs(facts.values()).filter(([newer, older]) => core.has(newer) || core.has(older));
    const missing = [...new Set(pairs.flat())].filter((q) => !byQid.has(q));
    const missingFacts = missing.length ? await fetchFacts(missing) : new Map<string, WikidataFacts>();

    // 3. Обновления существующих записей.
    const pleiadesOwner = new Map<string, string>();
    for (const row of rows) for (const e of row.externals ?? []) if (e.source === "pleiades") pleiadesOwner.set(e.id, String(row._id));

    let renamed = 0, located = 0, pleiadesAdded = 0, withNames = 0;
    const pleiadesConflicts: string[] = [];
    const updates: { _id: ObjectId; set: Record<string, any>; addExternal?: any[] }[] = [];

    // Места, у которых есть преемник: их упразднение — смена имени, а не руины.
    const withSuccessor = new Set(pairs.map(([, older]) => older));
    let unruined = 0;

    for (const [qid, row] of byQid) {
        const f = facts.get(qid);
        if (!f) continue;
        const nameSource = row.nameSource ?? (row.published === false ? "openbible" : "editor");
        const hasSuccessor = withSuccessor.has(qid);
        const u = enrichUpdate({ ...row, nameSource, ancient: isAncient(row), hasSuccessor }, f);
        const set: Record<string, any> = { names: u.names, updatedAt: now };
        if (u.names.some((n) => n.source === "wikidata")) withNames++;
        if (u.name) { set.name = u.name; set.nameSource = u.nameSource; renamed++; }
        if (u.location) { set.location = u.location; set.locationSource = u.locationSource; located++; }
        if (u.status) set.status = u.status;
        // «Руины», поставленные прежним прогоном по дате упразднения, снимаем. Руины из
        // OpenBible (телль на месте точки) не трогаем: там это наблюдение, а не вывод из P576.
        const fromOpenBible = (row.externals ?? []).some((e: any) => e.source === "openbible");
        if (hasSuccessor && row.status === "ruins" && f.dissolved !== undefined && !fromOpenBible) {
            set.status = null;
            unruined++;
        }
        // QID, найденный по ссылке на Википедию на шаге 1, в записи ещё не лежит.
        const addExternal: any[] = resolvedRows.has(String(row._id)) ? [{ source: "wikidata", id: qid }] : [];
        if (u.pleiades) {
            const owner = pleiadesOwner.get(u.pleiades);
            if (owner && owner !== String(row._id)) pleiadesConflicts.push(`pleiades:${u.pleiades} у ${row.name}`);
            else { addExternal.push({ source: "pleiades", id: u.pleiades }); pleiadesOwner.set(u.pleiades, String(row._id)); pleiadesAdded++; }
        }
        updates.push({ _id: row._id, set, addExternal });
    }

    // 4. Новые записи и связи.
    const created: { _id: ObjectId; qid: string; doc: any }[] = [];
    for (const qid of missing) {
        const f = missingFacts.get(qid);
        if (!f || !(f.labelRu || f.labelEn)) continue;
        // Предшественник (его кто-то «заменяет») — древнее место; преемник — нет.
        const ancient = pairs.some(([, older]) => older === qid);
        const neighbour = byQid.get(pairs.find(([a, b]) => a === qid || b === qid)!.find((q) => q !== qid)!);
        created.push({
            _id: new ObjectId(),
            qid,
            doc: {
                name: f.labelRu ?? f.labelEn,
                nameSource: "wikidata",
                kind: neighbour?.kind ?? "settlement",
                names: namesFromFacts(f, ancient),
                ...(f.location ? { location: f.location, locationSource: "wikidata" } : {}),
                externals: [{ source: "wikidata", id: qid }],
                origin: "wikidata-neighbor",
                published: false,
                createdAt: now,
                updatedAt: now,
            },
        });
    }
    const idOfQid = new Map<string, ObjectId>([
        ...[...byQid].map(([q, row]) => [q, row._id] as [string, ObjectId]),
        ...created.map((c) => [c.qid, c._id] as [string, ObjectId]),
    ]);
    const nameOfQid = new Map<string, string>([
        ...[...byQid].map(([q, row]) => [q, row.name] as [string, string]),
        ...created.map((c) => [c.qid, c.doc.name] as [string, string]),
    ]);
    const relations = pairs
        .filter(([newer, older]) => idOfQid.has(newer) && idOfQid.has(older))
        .map(([newer, older]) => ({ from: idOfQid.get(newer)!, to: idOfQid.get(older)!, type: "succeeds", confidence: "certain", source: "wikidata" }));

    console.log(`\n=== Отчёт ===`);
    console.log(`QID у записей: ${byQid.size}; фактов получено: ${facts.size}`);
    console.log(`Ручные записи получили QID: ${resolved.length ? resolved.join("; ") : "нет"}`);
    if (duplicates.length) console.log(`Дубли ручной и импортированной записи (не сведены): ${duplicates.join("; ")}`);
    console.log(`Русских меток: ${[...facts.values()].filter((f) => f.labelRu).length}; переименовано из английского: ${renamed}`);
    console.log(`Записей с именами из Wikidata: ${withNames}; точка поставлена: ${located}; ключ Pleiades добавлен: ${pleiadesAdded}`);
    if (pleiadesConflicts.length) console.log(`Ключ Pleiades уже у другой записи: ${pleiadesConflicts.length}`);
    console.log(`Пар преемственности: ${pairs.length}; недостающих в базе: ${missing.length}, заводится: ${created.length}; связей: ${relations.length}`);
    console.log(`Снято «руины» у мест с преемником: ${unruined}`);
    for (const [newer, older] of pairs.slice(0, 15)) console.log(`  ${nameOfQid.get(newer) ?? newer} ← ${nameOfQid.get(older) ?? older}`);

    if (!WRITE) {
        console.log(`Ничего не записано. Для записи: --write`);
        process.exit(0);
    }

    for (const u of updates) {
        const push = u.addExternal?.length ? { $push: { externals: { $each: u.addExternal } } as any } : {};
        await places.updateOne({ _id: u._id }, { $set: u.set, ...push });
    }
    if (created.length) await places.insertMany(created.map((c) => ({ _id: c._id, ...c.doc })));
    const rel = db.collection(PLACE_RELATIONS);
    await rel.deleteMany({ source: "wikidata" });
    if (relations.length) await rel.insertMany(relations);
    console.log(`Записано: обновлений ${updates.length}, новых записей ${created.length}, связей ${relations.length}`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
