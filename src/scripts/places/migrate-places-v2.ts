// Места: перевод прежних полей в новую модель (@/lib/places/schema).
//
// Что делает. У каждой записи `places` строковые координаты превращаются в точку
// GeoJSON `location` (ради индекса 2dsphere), а плоский список `synonyms` — в
// `names` с языком и ролью `variant`. Старые поля остаются на месте: на них
// смотрят публичный API v2 и редактор, и он же при сохранении выводит новые
// поля из старых тем же кодом (@/lib/places/legacy).
//
// АДРЕС ЗДЕСЬ НЕ ВЫДАЁТСЯ. По плану slug назначается при миграции, но выдаётся он
// один раз и навсегда, а у нынешних записей основное имя — современное («Анкара»),
// тогда как страница задумана для места во всей его истории. Какое имя встанет
// в адрес, решится после сведения с OpenBible и Wikidata; до того страницы
// открываются по прежним alias и _id.
//
// Скрипт идемпотентный: повторный прогон пишет те же значения.
//
// Запуск:  npm run places:migrate            # отчёт, ничего не пишет
//          npm run places:migrate -- --write # записать
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { namesWithSynonyms, toLocation } from "@/lib/places/legacy";
import { PLACES } from "@/lib/places/schema";

const WRITE = process.argv.includes("--write");

async function main() {
    const client = await clientPromise;
    const places = client.db("typikon").collection(PLACES);
    const rows = await places.find({}).toArray();

    let changed = 0;
    const noPoint: string[] = [];

    for (const row of rows) {
        const location = toLocation(row.latitude, row.longitude);
        const names = namesWithSynonyms(row.names, row.synonyms, row.name);
        const label = `${row.name} (${row.alias || row._id})`;

        if (!location) noPoint.push(`${label}: широта «${row.latitude ?? ""}», долгота «${row.longitude ?? ""}»`);

        const sameLocation = JSON.stringify(row.location ?? null) === JSON.stringify(location);
        const sameNames = JSON.stringify(row.names ?? []) === JSON.stringify(names);
        if (sameLocation && sameNames) {
            console.log(`  без изменений  ${label}`);
            continue;
        }

        changed++;
        console.log(`  ${WRITE ? "записано" : "будет"}       ${label}`);
        if (location) console.log(`                 точка [${location.coordinates.join(", ")}]`);
        if (names.length) console.log(`                 имена: ${names.map((n) => n.name).join(", ")}`);

        if (WRITE) {
            await places.updateOne(
                { _id: row._id },
                location
                    ? { $set: { location, names } }
                    : { $set: { names }, $unset: { location: "" } },
            );
        }
    }

    console.log(`\n=== Итого ===`);
    console.log(`Мест: ${rows.length}, к изменению: ${changed}, без точки: ${noPoint.length}`);
    for (const line of noPoint) console.log(`  без точки: ${line}`);
    if (!WRITE && changed) console.log(`Ничего не записано. Для записи: --write`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
