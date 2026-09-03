// окружение — первым, раньше mongodb
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";

// ПЕРЕЕЗД ПРИХОДСКОГО ИЗ typikon В typikon-users.
//
// Зачем — в src/lib/parish/db.ts. Коротко: `typikon` целиком накатывается с
// нашей машины (`release-db.sh`, `mongorestore --drop`), а приходское пишется
// на проде и у нас пустое. Пока оно лежало в `typikon`, каждая выкладка
// стирала приходам их же настройки.
//
// Запускать НА СЕРВЕРЕ и до первой выкладки новым кодом — иначе выкладка унесёт
// исходные коллекции раньше, чем их успеют перечитать:
//
//   npm run parish:move -- --dry     — только показать, что где лежит
//   npm run parish:move              — перенести и убрать исходные
//
// Повторный запуск безвреден: перенесённое уже не в `typikon`, и переносить
// нечего.

const COLLECTIONS = [
    "parishSettings",
    "parishEdits",
    "parishSchedules",
    "templeClaims",
    "templeAdmins",
];

const dry = process.argv.includes("--dry");

const main = async () => {
    const client = await clientPromise;
    const from = client.db("typikon");
    const to = client.db("typikon-users");

    // Что вообще есть в исходной базе: обращаться к несуществующей коллекции
    // Mongo позволяет и молча отдаёт пусто, а нам надо отличать «пусто» от
    // «уже переехало» — иначе отчёт врёт про сделанную работу.
    const present = new Set((await from.listCollections({}, { nameOnly: true }).toArray())
        .map((c) => c.name));

    let moved = 0;
    let conflicts = 0;

    for (const name of COLLECTIONS) {
        if (!present.has(name)) {
            console.log(`  ${name}: в typikon нет — уже переехало`);
            continue;
        }

        const docs = await from.collection(name).find({}).toArray();
        const there = await to.collection(name).countDocuments();
        console.log(`  ${name}: в typikon ${docs.length}, в typikon-users ${there}`);

        if (dry) continue;

        for (const doc of docs) {
            // НЕ ПЕРЕЗАПИСЫВАЕМ. Если запись с тем же _id уже на новом месте,
            // она там свежее: сайт уже пишет туда, а здесь лежит слепок «до».
            // Затереть её значило бы откатить приходу его же правку.
            const exists = await to.collection(name).countDocuments({ _id: doc._id }, { limit: 1 });
            if (exists) {
                conflicts += 1;
                console.log(`    ${String(doc._id)}: уже на новом месте, оставлено как есть`);
                continue;
            }
            await to.collection(name).insertOne(doc);
            moved += 1;
        }

        // Исходную убираем СРАЗУ за переносом, а не в конце общим махом: иначе
        // оборвавшийся посередине запуск оставил бы часть коллекций в обеих
        // базах, и какая из двух копий главная, выяснять было бы нечем.
        await from.collection(name).drop();
        console.log(`    убрано из typikon`);
    }

    if (dry) {
        console.log("это была примерка (--dry), ничего не тронуто");
    } else {
        console.log(`перенесено записей: ${moved}`
            + (conflicts ? `, оставлено на новом месте: ${conflicts}` : ""));
    }
};

main()
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(async () => { (await clientPromise).close(); });
