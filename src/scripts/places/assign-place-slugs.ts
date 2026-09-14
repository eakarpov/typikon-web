// Места: имя для показа, адрес страницы и публикация. Этап 3 — после этапов 1 и 2.
//
// Что делает:
//  1. Имя для показа (@/lib/places/naming): метка Wikidata «Хорив (гора)» становится
//     «Хорив», если такое короткое имя не встречается у другого места.
//  2. Адрес `slug` — один раз и навсегда (правило assign-saint-slugs): у записи с
//     адресом он не меняется, даже если имя потом поправят.
//  3. Публикация: показывается всякое место с русским именем. Место с английским
//     именем остаётся скрытым — на странице его не прочесть. Скрытое вручную
//     записью не открывается: скрипт снимает только отметку импорта.
//
// Запуск:  npm run places:slugs            # отчёт, ничего не пишет
//          npm run places:slugs -- --write # записать
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { slugify, uniqueAlias } from "@/lib/news/format";
import { displayNames, hasCyrillic } from "@/lib/places/naming";
import { PLACES } from "@/lib/places/schema";

const WRITE = process.argv.includes("--write");

async function main() {
    const db = (await clientPromise).db("typikon");
    const places = db.collection(PLACES);
    const rows = await places.find({}, { projection: { name: 1, nameSource: 1, slug: 1, alias: 1, published: 1, hiddenByEditor: 1 } }).toArray();

    const names = displayNames(rows.map((r) => ({ id: String(r._id), name: r.name, nameSource: r.nameSource })));
    const taken = new Set<string>(rows.map((r) => r.slug).filter(Boolean));

    const updates: { _id: any; set: Record<string, any> }[] = [];
    const renamed: string[] = [];
    let slugged = 0, published = 0, hidden = 0;

    // Устойчивый порядок: второму «Язеру» достаётся «-2», и номер не переезжает между прогонами.
    for (const row of [...rows].sort((a, b) => String(a._id).localeCompare(String(b._id)))) {
        const name = names.get(String(row._id))!;
        if (!hasCyrillic(name)) { hidden++; continue; }
        const set: Record<string, any> = {};
        if (name !== row.name) { set.name = name; renamed.push(`${row.name} → ${name}`); }
        if (!row.slug) {
            const slug = uniqueAlias(slugify(name), taken);
            taken.add(slug);
            set.slug = slug;
            slugged++;
        }
        if (row.published === false && !row.hiddenByEditor) { set.published = true; published++; }
        if (Object.keys(set).length) updates.push({ _id: row._id, set: { ...set, updatedAt: new Date() } });
    }

    console.log(`\n=== Отчёт ===`);
    console.log(`Мест: ${rows.length}; с русским именем: ${rows.length - hidden}, без него (остаются скрытыми): ${hidden}`);
    console.log(`Адрес получат: ${slugged}; откроются: ${published}; имя сократится: ${renamed.length}`);
    for (const line of renamed.slice(0, 20)) console.log(`  ${line}`);

    if (!WRITE) {
        console.log(`Ничего не записано. Для записи: --write`);
        process.exit(0);
    }
    for (const u of updates) await places.updateOne({ _id: u._id }, { $set: u.set });
    console.log(`Записано: ${updates.length}`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
