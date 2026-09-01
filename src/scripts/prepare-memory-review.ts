// Подготовка сверки связей «память — святой»: второй голос, группы, порядок.
//
// Сверять 653 кандидата подряд долго, и большая часть этого труда лишняя.
// Скрипт не решает за человека, а РАЗБИРАЕТ кучу: бесспорное отделяет,
// повторяющееся сводит, остальное выстраивает по силе.
//
// ДАТА — ВТОРОЙ ГОЛОС, И НЕЗАВИСИМЫЙ. Сопоставитель считал только слова имени.
// А у святого в святцах есть день памяти, и если он совпал с числом, под
// которым книга печатает службу, — это согласие из другого источника. Имя и
// дата вместе — уже не догадка: одно проверяет другое.
//
// Даты есть не у всех: из 653 кандидатов 452 указывают на святого, которого в
// нашем каталоге нет вовсе (сопоставитель предлагал и тех, кого мы не заводили).
// У них второго голоса нет, и притворяться, что есть, мы не будем: dateAgrees
// у таких остаётся null, и они идут в общую очередь.
//
// ОДИН СВЯТОЙ — ОДНО РЕШЕНИЕ. Он предлагается нескольким памятям сразу:
// предпразднство, попразднство и отдание одного праздника, «ина служба» тому же
// дню. Подтверждать одно и то же трижды незачем, и sameSaint показывает, что
// решение это общее.
//
// МАШИНОЙ ПРИНИМАЕМ ТОЛЬКО ДВОЙНОЕ СОГЛАСИЕ — имя целиком и дата. И помечаем:
// approvedBy = "machine". Человек должен видеть, где его рука, а где не его;
// пересмотреть машинное потом можно одним запросом.
//
// Запуск:  npm run memories:review-prep  [-- --write]
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";

/** Число месяца памяти в записи святцев: «16.12» — день и месяц. */
const churchDate = (month: number, day: number) =>
    `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}`;

const main = async () => {
    const write = process.argv.includes("--write");
    const db = (await clientPromise).db("typikon");
    const links = await db.collection("memory_saint_links").find({}).toArray() as any[];
    const memories = await db.collection("memories")
        .find({}, { projection: { month: 1, day: 1, book: 1 } }).toArray();
    const mem = new Map(memories.map((m: any) => [m._id, m]));

    const saints = await db.collection("saints")
        .find({}, { projection: { name: 1, memoryDates: 1, externals: 1 } }).toArray() as any[];
    const byDneslov = new Map<string, any>();
    for (const s of saints) {
        for (const e of (s.externals ?? [])) {
            if (e.source === "dneslov") byDneslov.set(String(e.id), s);
        }
    }

    // Сколько памятей делят одного святого: решение по ним общее
    const perSaint = new Map<string, number>();
    for (const l of links) {
        const key = String(l.dneslovId);
        perSaint.set(key, (perSaint.get(key) ?? 0) + 1);
    }

    let approved = 0, agreed = 0, disagreed = 0, unknown = 0;
    const ops: any[] = [];
    for (const link of links) {
        const memory: any = mem.get(link.memoryId);
        const saint = byDneslov.get(String(link.dneslovId));
        const dates: string[] = saint?.memoryDates ?? [];

        let dateAgrees: boolean | null = null;
        if (memory?.month && dates.length) {
            dateAgrees = dates.includes(churchDate(memory.month, memory.day));
            dateAgrees ? agreed++ : disagreed++;
        } else unknown++;

        const sameSaint = perSaint.get(String(link.dneslovId)) ?? 1;
        // Порядок сверки: сперва то, где согласий больше. Считаем не «качество»
        // вообще, а сколько независимых примет сошлось
        const confidence = (link.score >= 1 ? 2 : link.score >= 0.6 ? 1 : 0)
            + (dateAgrees === true ? 2 : dateAgrees === false ? -1 : 0);

        const set: any = { dateAgrees, sameSaint, confidence };
        // ДВОЙНОЕ СОГЛАСИЕ — имя целиком и дата — принимаем машиной
        if (link.status === "pending" && link.score >= 1 && dateAgrees === true) {
            set.status = "approved";
            set.approvedBy = "machine";
            set.approvedReason = "имя совпало целиком и день памяти сошёлся с числом книги";
            set.approvedAt = new Date();
            approved++;
        }
        ops.push({ updateOne: { filter: { _id: link._id }, update: { $set: set } } });
    }

    console.log(`кандидатов: ${links.length}`);
    console.log(`  дата сошлась: ${agreed}, разошлась: ${disagreed}, святого нет в каталоге: ${unknown}`);
    console.log(`  один святой на нескольких памятях: экономия ${
        [...perSaint.values()].reduce((a, n) => a + n - 1, 0)} решений`);
    console.log(`  принято машиной (имя + дата): ${approved}`);
    console.log(`  остаётся глазами: ${links.length - approved}`);

    if (!write) { console.log("\n(пробный прогон; чтобы записать — с ключом --write)"); process.exit(0); }
    for (let i = 0; i < ops.length; i += 500) {
        await db.collection("memory_saint_links").bulkWrite(ops.slice(i, i + 500), { ordered: false });
    }
    console.log("записано.");
    process.exit(0);
};

main();
