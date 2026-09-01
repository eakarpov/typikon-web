// Импорт РЕЕСТРА ПАМЯТЕЙ из корпуса typikon-rules в коллекцию `memories`.
//
// Память — это не святой, а СЛУЖБА, назначенная книгой на своё место: у Минеи
// на число месяца, у Триодей на отступ от Пасхи, у Октоиха на глас и день
// седмицы, у Общей Минеи на разряд святого. Святой при ней бывает, а бывает и
// нет: под иконой, Господним праздником или собором лица нет вовсе или их
// много.
//
// ЗАПИСЬ ПАМЯТИ САМОСТОЯТЕЛЬНА, а связь со святым dneslov.org — дополнение.
// Ждать полного сопоставления реестр не может и не должен: у 93 памятей все
// кандидаты святцев без имён вовсе, а Павла Обнорского они зовут Комельским.
// Соответствие притом НЕ ОДИН К ОДНОМУ — у собора лиц несколько, у одного
// святого памятей несколько, — и связь живёт своей коллекцией
// (memory_saint_links), а не полем внутри памяти.
//
// ОТДЕЛЬНОЙ КОМАНДОЙ, не вместе с Библией. Библию пересобирают часто, реестр
// памятей — редко: он меняется, только когда разбор устава научился новому.
// Держать их в одном запуске значило бы гонять полторы тысячи записей ради
// правки в стихе Товита.
//
// ЛИШНЕЕ УБИРАЕТСЯ, как и у Библии: перезапись по устойчивому _id повторяема
// лишь наполовину — изменившаяся память перепишется, а ИСЧЕЗНУВШАЯ осталась бы
// навсегда. Разбор устава меняется, памяти сливаются и расходятся, и вчерашняя
// «вторая служба» может завтра оказаться вариантом первой.
//
// ИДЕНТИФИКАТОР — САМ memoryId, а не хеш: он уже устойчив, читаем и на него
// ссылаются связи со святыми, размеченные людьми. Хеш сделал бы эти ссылки
// нечитаемыми без всякой пользы.
//
// Запуск:
//   npm run memories:import  [-- <путь к memories.json>]
import "@/scripts/lib/env";
import fs from "node:fs";
import path from "node:path";
import clientPromise from "@/lib/mongodb";

const DEFAULT_IN = path.resolve(process.cwd(), "memories", "output", "memories.json");

interface MemoryDoc {
    memoryId: string;
    book: string;
    addressBy: string;
    label: string;
    [k: string]: unknown;
}

const main = async () => {
    const argv = process.argv.slice(2);
    const file = argv.find(a => !a.startsWith("--")) ?? DEFAULT_IN;
    if (!fs.existsSync(file)) {
        console.error(`нет файла ${file} — сначала выгрузите его в typikon-rules:`);
        console.error("  python3 scripts/export_memories.py");
        process.exit(1);
    }

    const payload = JSON.parse(fs.readFileSync(file, "utf8")) as { memories: MemoryDoc[] };
    const rows = payload.memories ?? [];
    if (!rows.length) {
        console.error("в файле нет ни одной памяти — импорт отменён");
        process.exit(1);
    }

    const db = (await clientPromise).db("typikon");
    const col = db.collection("memories");

    const ops = rows.map(m => ({
        replaceOne: {
            filter: { _id: m.memoryId as any },
            replacement: { ...m, _id: m.memoryId, importedAt: new Date() } as any,
            upsert: true,
        },
    }));
    for (let i = 0; i < ops.length; i += 500) {
        await col.bulkWrite(ops.slice(i, i + 500), { ordered: false });
    }

    const seen = rows.map(m => m.memoryId);
    const gone = await col.deleteMany({ _id: { $nin: seen as any } });

    // СВЯЗИ, УКАЗЫВАЮЩИЕ В ПУСТОТУ, — не беда импорта, но знать о них надо:
    // разметка людей переживает пересборку корпуса, а память под нею могла
    // исчезнуть или переименоваться.
    const linked = await db.collection("memory_saint_links").distinct("memoryId");
    const orphans = linked.filter(id => !seen.includes(id));

    const byBook = rows.reduce<Record<string, number>>((acc, m) => {
        acc[m.book] = (acc[m.book] ?? 0) + 1; return acc;
    }, {});
    console.log(`памятей записано: ${rows.length} — ` +
        Object.entries(byBook).sort().map(([b, n]) => `${b} ${n}`).join(", "));
    console.log(`  со знаком службы: ${rows.filter(m => m.sign).length}`);
    console.log(`  в круге праздника: ${rows.filter(m => m.feastCycle).length}`);
    if (gone.deletedCount) console.log(`  убрано исчезнувших: ${gone.deletedCount}`);
    console.log(`  связей со святыми: ${linked.length}` +
        (orphans.length ? `, из них указывают в пустоту: ${orphans.length} (${orphans.slice(0, 3).join(", ")}…)` : ""));
    process.exit(0);
};

main();
