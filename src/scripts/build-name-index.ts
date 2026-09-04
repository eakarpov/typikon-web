import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { namesOf, nameKey, type Confidence } from "@/lib/imeniny/core";

// Указатель имён: имя — святые — дни их памяти.
//
// Строится из заголовков святцев (`saints.title`) РАЗБОРОМ, а не берётся
// готовым: указателя имён у собрания нет вовсе (см. @/lib/imeniny/core).
// Значит, всё, что здесь получается, — наш вывод, и главная работа скрипта
// не запись, а ОТЧЁТ: разбор надо посмотреть глазами прежде, чем строить на
// нём страницу, которую человек примет за святцы.
//
// Ничего не пишет без --write.
//
// Запуск:  npm run names:index [-- --write] [-- --show 40] [-- --name Николай]

interface SaintRow {
    slug: string;
    name: string;
    title: string | null;
    type: string | null;
    memoryDates: string[];
}

interface IndexedSaint {
    slug: string;
    name: string;
    /** Дни памяти по церковному счёту, как они записаны в святцах: «16.12». */
    dates: string[];
    confidence: Confidence;
}

const main = async () => {
    const argv = process.argv;
    const write = argv.includes("--write");
    const show = Number(argv[argv.indexOf("--show") + 1]) || 25;
    const only = argv.includes("--name") ? argv[argv.indexOf("--name") + 1] : null;

    const db = (await clientPromise).db("typikon");
    const saints = await db.collection("saints")
        .find({}, { projection: { slug: 1, name: 1, title: 1, type: 1, memoryDates: 1 } })
        .toArray() as unknown as SaintRow[];

    const index = new Map<string, { name: string; saints: IndexedSaint[] }>();
    const nameless: SaintRow[] = [];
    const guessed: Array<{ saint: SaintRow; names: string[] }> = [];
    const skippedWords = new Map<string, number>();
    let withDates = 0;

    for (const saint of saints) {
        // Вещь, здание и место именин не дают: у ризы Господней нет имени,
        // которое кто-то носит.
        if (saint.type && !["Identity", "Council"].includes(saint.type)) continue;

        // Заголовка может не быть вовсе (у 54 святых его нет): тогда разбираем
        // само имя записи — «Евсхимо́н Лампса́кский» отдаёт имя не хуже
        // заголовка, просто в нём сразу и прозвание по месту.
        const got = namesOf(saint.title || saint.name, saint.type);
        got.skipped.forEach(w => skippedWords.set(w, (skippedWords.get(w) ?? 0) + 1));

        if (!got.names.length) {
            nameless.push(saint);
            continue;
        }
        if (got.confidence === "guess") guessed.push({ saint, names: got.names });
        if (saint.memoryDates?.length) withDates++;

        for (const name of got.names) {
            const key = nameKey(name);
            const entry = index.get(key) ?? { name, saints: [] };
            entry.saints.push({
                slug: saint.slug,
                name: saint.name,
                dates: saint.memoryDates ?? [],
                confidence: got.confidence,
            });
            index.set(key, entry);
        }
    }

    const n = (value: number) => value.toLocaleString("ru-RU");
    const rows = [...index.entries()].sort((a, b) => b[1].saints.length - a[1].saints.length);
    const persons = saints.filter(s => !s.type || ["Identity", "Council"].includes(s.type));

    console.log(`святцев: ${n(saints.length)}, из них лиц и соборов: ${n(persons.length)}`);
    console.log(`имён в указателе: ${n(index.size)}; святых под ними: `
        + `${n(persons.length - nameless.length)} (${Math.round((persons.length - nameless.length) / persons.length * 100)}%)`);
    const datesMissing = persons.length - nameless.length - withDates;
    console.log(`с днями памяти: ${n(withDates)}; без дат: ${n(datesMissing)} `
        + `(имя есть, а дня памяти нет — именин по ним не назначить)`);
    console.log(`без имени: ${n(nameless.length)}; разобрано догадкой (соборы): ${n(guessed.length)}`);

    // ДНИ ПАМЯТИ БЫВАЮТ ДВУХ РОДОВ, и для именин это не мелочь: «01.04» —
    // число месяцеслова, одно и то же всякий год, а «-14» — смещение от Пасхи,
    // и в гражданском календаре оно каждый год иное. Считать «ближайшую память
    // после дня рождения» придётся, разрешив второе в дату года.
    const movable = [...index.values()].flatMap(e => e.saints)
        .filter(s => s.dates.some(d => /^-?\d+$/.test(d))).length;
    console.log(`дней памяти подвижных (смещением от Пасхи): у ${n(movable)} записей\n`);

    if (only) {
        const entry = index.get(nameKey(only));
        console.log(`— ${only} —`);
        if (!entry) console.log("  такого имени в указателе нет");
        else entry.saints.forEach(s =>
            console.log(`  ${s.name.padEnd(42)} ${s.dates.join(", ") || "— дат нет —"}`
                + (s.confidence === "guess" ? "  [догадка]" : "")));
    } else {
        console.log("частые имена:");
        rows.slice(0, show).forEach(([, entry]) =>
            console.log(`  ${entry.name.padEnd(20)} ${String(entry.saints.length).padStart(3)} святых`));
    }

    console.log(`\nбез имени (${n(nameless.length)}), первые ${Math.min(show, nameless.length)}:`);
    nameless.slice(0, show).forEach(s =>
        console.log(`  ${(s.type ?? "—").padEnd(9)} ${String(s.title ?? s.name).slice(0, 66)}`));

    console.log("\nчаще всего отброшено перед именем:");
    console.log("  " + [...skippedWords.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
        .map(([w, c]) => `${w}×${c}`).join(", "));

    console.log(`\nразобранные догадкой (соборы), первые ${Math.min(8, guessed.length)}:`);
    guessed.slice(0, 8).forEach(g =>
        console.log(`  ${g.names.slice(0, 6).join(", ")}${g.names.length > 6 ? "…" : ""}`
            + `\n      ← ${String(g.saint.title).slice(0, 76)}`));

    if (!write) {
        console.log("\nпробный прогон; чтобы записать — --write");
        return;
    }

    const target = db.collection("name_index");
    await target.createIndex({ key: 1 }, { unique: true });
    for (const [key, entry] of index) {
        await target.updateOne(
            { key },
            { $set: { key, name: entry.name, saints: entry.saints, builtAt: new Date() } },
            { upsert: true },
        );
    }
    const gone = await target.deleteMany({ key: { $nin: [...index.keys()] } });
    console.log(`\nзаписано имён: ${n(index.size)}; удалено выпавших: ${gone.deletedCount}`);
};

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
