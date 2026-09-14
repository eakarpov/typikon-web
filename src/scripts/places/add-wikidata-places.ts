// Места вне OpenBible — из Wikidata по списку. Первые: Константинополь, Никея, Халкидон.
//
// Зачем. Указатель собран из библейских мест, а Пролог и отцы на каждом шагу называют
// места позднейшей церковной истории: столицу, города Вселенских соборов. Без записей
// поиск по текстам (link-text-places) их просто не находит.
//
// Что делает: заводит записи по QID из SEEDS (русская метка, точка, ключ Wikidata),
// добавляет им формы имени от редактора и связи преемственности от редактора. Прочее —
// имена по эпохам, ключ Pleiades, связи «заменяет / заменён на» — дописывают обычные
// шаги после этого скрипта:
//   npm run places:enrich-wikidata -- --write   (подтянет Стамбул как преемника Константинополя)
//   npm run places:enrich-pleiades -- --write
//   npm run places:slugs -- --write
//   npm run places:link-texts -- --write && npm run places:link-chants -- --write
//
// ФОРМЫ ОТ РЕДАКТОРА — НЕ УКРАШЕНИЕ. Константинополь в корпусе назван так лишь в 38
// текстах, а «Константинь град», «Константиня града» — в 141, «Царьград» — в 6. Метка
// Wikidata одна, синонимы Wikidata в поиск не идут (@/lib/places/textmatch), и без этих
// форм большая часть упоминаний осталась бы ненайденной.
//
// СВЯЗИ ОТ РЕДАКТОРА. У Никеи и Халкидона в Wikidata нет «заменён на», есть только
// «находится в» (P131): Изник и Кадыкёй стоят на тех же местах. Преемственность здесь
// — вывод, а не данные Wikidata, поэтому связь пишется с source: "editor" и примечанием;
// пересборка связей Wikidata её не трогает.
//
// Запуск:  npm run places:add-wikidata            # отчёт
//          npm run places:add-wikidata -- --write # записать
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { sparql, qidOf } from "@/scripts/lib/wikidata";
import { parseWktPoint } from "@/lib/places/wikidata";
import { PLACE_RELATIONS, PLACES, type PlaceName } from "@/lib/places/schema";

const WRITE = process.argv.includes("--write");

const editorName = (name: string, role: PlaceName["role"] = "slavonic"): PlaceName => ({ name, lang: "ru", role, source: "editor" });

const SEEDS: { qid: string; kind: string; names?: PlaceName[] }[] = [
    {
        qid: "Q16869", kind: "settlement", // Константинополь
        names: ["Константинь град", "Константиня град", "Константина град", "Царьград", "Цареград"].map((n) => editorName(n)),
    },
    { qid: "Q23725", kind: "settlement" },  // Византий
    { qid: "Q739037", kind: "settlement" }, // Никея
    { qid: "Q217125", kind: "settlement" }, // Изник
    { qid: "Q337381", kind: "settlement" }, // Халкидон
    { qid: "Q932886", kind: "region" },     // Кадыкёй (район Стамбула)
];

/** Преемственность от редактора: [преемник, предшественник, примечание]. */
const RELATIONS: [string, string, string][] = [
    ["Q217125", "Q739037", "Изник стоит на месте Никеи (Wikidata P131: Никея находится в пределах Изника)"],
    ["Q932886", "Q337381", "Кадыкёй стоит на месте Халкидона (Wikidata P131: Халкидон находится в пределах Кадыкёя)"],
];

async function main() {
    const db = (await clientPromise).db("typikon");
    const places = db.collection(PLACES);

    const rows = await sparql(`SELECT ?item ?ru ?en ?coord WHERE {
      VALUES ?item { ${SEEDS.map((s) => `wd:${s.qid}`).join(" ")} }
      OPTIONAL { ?item rdfs:label ?ru FILTER(lang(?ru) = "ru") }
      OPTIONAL { ?item rdfs:label ?en FILTER(lang(?en) = "en") }
      OPTIONAL { ?item wdt:P625 ?coord }
    }`);
    const facts = new Map<string, { ru?: string; en?: string; coord?: string }>();
    for (const r of rows) {
        const q = qidOf(r.item?.value)!;
        const f = facts.get(q) ?? {};
        f.ru ??= r.ru?.value; f.en ??= r.en?.value; f.coord ??= r.coord?.value;
        facts.set(q, f);
    }

    const now = new Date();
    const idOf = new Map<string, any>();
    const lines: string[] = [];
    for (const seed of SEEDS) {
        const existing = await places.findOne({ externals: { $elemMatch: { source: "wikidata", id: seed.qid } } }, { projection: { name: 1, names: 1 } });
        const f = facts.get(seed.qid) ?? {};
        const location = parseWktPoint(f.coord);
        if (existing) {
            idOf.set(seed.qid, existing._id);
            const missing = (seed.names ?? []).filter((n) => !(existing.names ?? []).some((e: any) => e.name === n.name));
            lines.push(`  есть: ${existing.name} (${seed.qid})${missing.length ? `; добавятся формы: ${missing.map((n) => n.name).join(", ")}` : ""}`);
            if (WRITE) {
                await places.updateOne({ _id: existing._id }, {
                    ...(missing.length ? { $push: { names: { $each: missing } } as any } : {}),
                    // Запись из списка, а не сосед: обогащение из Wikidata считает её «своей».
                    $set: { origin: "editor-seed", updatedAt: now },
                });
            }
            continue;
        }
        const name = f.ru ?? f.en;
        if (!name) { lines.push(`  нет метки у ${seed.qid} — пропущено`); continue; }
        lines.push(`  новое: ${name} (${seed.qid})${location ? "" : ", без точки"}${seed.names?.length ? `; формы: ${seed.names.map((n) => n.name).join(", ")}` : ""}`);
        if (!WRITE) continue;
        const { insertedId } = await places.insertOne({
            name, nameSource: "wikidata", kind: seed.kind,
            names: seed.names ?? [],
            ...(location ? { location, locationSource: "wikidata", precision: "approx" } : {}),
            externals: [{ source: "wikidata", id: seed.qid }],
            origin: "editor-seed",
            published: true, createdAt: now, updatedAt: now,
        });
        idOf.set(seed.qid, insertedId);
    }

    console.log(`\n=== Отчёт ===\n${lines.join("\n")}`);
    for (const [newer, older, note] of RELATIONS) {
        console.log(`  связь: ${facts.get(newer)?.ru ?? newer} ← ${facts.get(older)?.ru ?? older} (${note})`);
        if (!WRITE || !idOf.get(newer) || !idOf.get(older)) continue;
        await db.collection(PLACE_RELATIONS).updateOne(
            { from: idOf.get(newer), to: idOf.get(older), type: "succeeds", source: "editor" },
            { $set: { confidence: "certain", note } },
            { upsert: true },
        );
    }
    if (!WRITE) console.log(`Ничего не записано. Для записи: --write`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
