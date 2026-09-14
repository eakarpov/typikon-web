// Места: каркас библейской географии из OpenBible Bible Geocoding (CC BY 4.0).
//
// Что делает. Разбирает ancient.jsonl и modern.jsonl (@/lib/places/openbible) и
// заводит места, связи отождествления и перечень стихов:
//
//   places           — запись на древнее место и на каждую его точку-кандидата;
//                      древнее место и точка с общим QID сводятся в одну запись;
//   place_relations  — связи с source: "openbible" пересобираются целиком;
//   openbible_verses — стихи мест в нумерации источника (OSIS, английская
//                      традиция). Это не упоминания: в канон сайта их переводит
//                      этап 2 со сверкой по славянскому тексту.
//
// МЕСТА ЗАВОДЯТСЯ СКРЫТЫМИ (`published: false`) и с английским именем: русские
// формы дадут энциклопедия Никифора и Wikidata. Уже существующая запись находится
// по внешнему ключу OpenBible; имена, точка и ключи из других источников при
// повторном прогоне не трогаются, как и точка, поставленная редактором.
//
// Места, заведённые руками до импорта, сводятся по таблице MANUAL ниже: их
// немного, и сопоставление по имени здесь надёжнее автоматического.
//
// Данные скачиваются в script-data/openbible (каталог в .gitignore) один раз;
// чтобы обновить, удалите каталог.
//
// Запуск:  npm run places:import-openbible            # отчёт, ничего не пишет
//          npm run places:import-openbible -- --write # записать
import "@/scripts/lib/env";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { buildPlan, ObAncient, ObModern } from "@/lib/places/openbible";
import { PLACE_RELATIONS, PLACES } from "@/lib/places/schema";

const WRITE = process.argv.includes("--write");
const DIR = path.join(process.cwd(), "script-data", "openbible");
const RAW = "https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data";
const VERSES = "openbible_verses";

/** Места, заведённые руками: alias → friendly_id древнего места в OpenBible. */
const MANUAL: Record<string, string> = {
    "city-alexandria": "Alexandria",
};

const load = async <T>(file: string): Promise<T[]> => {
    const target = path.join(DIR, file);
    if (!existsSync(target)) {
        mkdirSync(DIR, { recursive: true });
        console.log(`скачиваю ${file}…`);
        const res = await fetch(`${RAW}/${file}`);
        if (!res.ok) throw new Error(`${file}: ${res.status}`);
        writeFileSync(target, await res.text());
    }
    return readFileSync(target, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
};

const count = <T>(items: T[], key: (item: T) => string) => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ");
};

async function main() {
    const ancients = await load<ObAncient>("ancient.jsonl");
    const moderns = await load<ObModern>("modern.jsonl");
    const plan = buildPlan(ancients, moderns);
    const { report } = plan;

    console.log(`\n=== Разбор ===`);
    console.log(`Древних мест: ${ancients.length}; заводится ${report.ancient}, «не место» пропущено ${report.notAPlace.length}`);
    console.log(`Точек: ${moderns.length}; заводится ${report.modern} отдельно и ${report.merged} сведено с древним местом; `
        + `без сопоставления от 100 баллов не заводится ${report.unusedModern}`);
    console.log(`Сопоставлений ниже 100 баллов отброшено: ${report.lowScoreDropped}`);
    console.log(`Записей: ${plan.places.length}, по роду: ${count(plan.places, (p) => p.kind)}`);
    console.log(`Связей: ${plan.relations.length}; ${count(plan.relations, (r) => `${r.type}/${r.confidence}`)}`);
    console.log(`С QID Wikidata: ${plan.places.filter((p) => p.externals.some((e) => e.source === "wikidata")).length}, `
        + `с ключом Pleiades: ${plan.places.filter((p) => p.externals.some((e) => e.source === "pleiades")).length}, `
        + `с точкой: ${plan.places.filter((p) => p.location).length}`);
    console.log(`Стихов: ${plan.verses.length}`);
    if (report.qidConflicts.length) {
        console.log(`Внешний ключ у нескольких записей (оставлен первой): ${report.qidConflicts.length}`);
        for (const line of report.qidConflicts) console.log(`  ${line}`);
    }
    console.log(`«Не место»: ${report.notAPlace.join(", ")}`);

    const db = (await clientPromise).db("typikon");
    const places = db.collection(PLACES);

    // Ручные записи: какой ключ OpenBible к какой из них прикрепить.
    const manualByKey = new Map<string, ObjectId>();
    for (const [alias, friendlyId] of Object.entries(MANUAL)) {
        const ancient = ancients.find((a) => a.friendly_id === friendlyId);
        const row = await places.findOne({ alias }, { projection: { _id: 1 } });
        if (!ancient || !row) {
            console.log(`  ручная связка не сошлась: ${alias} → ${friendlyId} (${ancient ? "нет записи" : "нет в OpenBible"})`);
            continue;
        }
        manualByKey.set(ancient.id, row._id);
    }

    const existing = await places.find(
        { "externals.source": "openbible" },
        { projection: { externals: 1, names: 1, locationSource: 1, location: 1 } },
    ).toArray();
    const byKey = new Map<string, any>();
    for (const row of existing) for (const e of row.externals) if (e.source === "openbible") byKey.set(e.id, row);

    let created = 0, updated = 0;
    const idOfKey = new Map<string, ObjectId>();
    const now = new Date();

    for (const place of plan.places) {
        const manualId = place.keys.map((k) => manualByKey.get(k)).find(Boolean);
        const row = place.keys.map((k) => byKey.get(k)).find(Boolean)
            ?? (manualId ? await places.findOne({ _id: manualId }, { projection: { externals: 1, names: 1, locationSource: 1, location: 1 } }) : null);

        const _id: ObjectId = row?._id ?? new ObjectId();
        for (const k of place.keys) idOfKey.set(k, _id);
        row ? updated++ : created++;
        if (!WRITE) continue;

        // Чужое не трогаем: имена и ключи других источников остаются, свои заменяются.
        const names = [...(row?.names ?? []).filter((n: any) => n.source !== "openbible"), ...place.names];
        const theirs = (row?.externals ?? []).filter((e: any) =>
            !place.externals.some((p) => p.source === e.source && p.id === e.id) && e.source !== "openbible");
        const externals = [...theirs, ...place.externals];
        const locationOurs = !row || !row.location && !row.locationSource || row.locationSource === "openbible";

        await places.updateOne(
            { _id },
            {
                $set: {
                    kind: place.kind,
                    names,
                    externals,
                    updatedAt: now,
                    ...(locationOurs && place.location
                        ? { location: place.location, locationSource: "openbible", precision: place.precision }
                        : {}),
                    ...(locationOurs && place.status ? { status: place.status } : {}),
                },
                $setOnInsert: { name: place.name, nameSource: "openbible", published: false, createdAt: now },
            },
            { upsert: true },
        );
    }
    console.log(`\nЗаписей новых: ${created}, уже известных: ${updated}`);

    if (WRITE) {
        const relations = db.collection(PLACE_RELATIONS);
        await relations.deleteMany({ source: "openbible" });
        if (plan.relations.length) {
            await relations.insertMany(plan.relations.map((r) => ({
                from: idOfKey.get(r.from)!, to: idOfKey.get(r.to)!, type: r.type,
                confidence: r.confidence, score: r.score, source: "openbible",
            })));
        }
        // Источник имени у записей первого прогона не был проставлен: имя у них
        // осталось английским, если обогащение его не заменило (оно ставит своё).
        await places.updateMany(
            { "externals.source": "openbible", published: false, nameSource: { $exists: false } },
            { $set: { nameSource: "openbible" } },
        );
        const verses = db.collection(VERSES);
        await verses.deleteMany({});
        await verses.insertMany(plan.verses.map((v) => ({ placeId: idOfKey.get(v.key)!, ...v })));
        await verses.createIndex({ placeId: 1 });
        console.log(`Связей записано: ${plan.relations.length}, стихов: ${plan.verses.length}`);
    } else {
        console.log(`Ничего не записано. Для записи: --write`);
    }
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
