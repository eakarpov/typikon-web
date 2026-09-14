// Места: разметка {pl|…} во всех текстах → принятые упоминания (@/lib/places/markup).
//
// Дальше это делает сохранение текста в редакторе; скрипт нужен один раз, для
// разметки, стоявшей до появления упоминаний, и после массовых правок в обход редактора.
//
// Запуск:  npm run places:sync-markup            # отчёт
//          npm run places:sync-markup -- --write # записать
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { markupPlaces, syncMarkupMentions } from "@/lib/places/markup";

const WRITE = process.argv.includes("--write");

async function main() {
    const db = (await clientPromise).db("typikon");
    const texts = await db.collection("texts").find({ content: /\{pl\|/ }, { projection: { name: 1, content: 1 } }).toArray();
    let marks = 0, linked = 0;
    const unknown: string[] = [];
    for (const t of texts) {
        if (!WRITE) { marks += markupPlaces(t.content).length; continue; }
        const r = await syncMarkupMentions(db, t._id, t.content);
        marks += r.marks; linked += r.linked;
        unknown.push(...r.unknown.map((k) => `${t.name}: ${k}`));
    }
    console.log(`Текстов с разметкой: ${texts.length}; пометок: ${marks}${WRITE ? `; связано мест: ${linked}` : ""}`);
    if (unknown.length) console.log(`Пометки на неизвестные места:\n  ${unknown.join("\n  ")}`);
    if (!WRITE) console.log(`Ничего не записано. Для записи: --write`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
