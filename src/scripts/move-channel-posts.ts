// окружение — первым, раньше mongodb
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { CHANNEL_POSTS } from "@/lib/channelPosts/db";

// ПЕРЕЕЗД ПОСТОВ КАНАЛА ИЗ typikon В typikon-users.
//
// Зачем — в src/lib/channelPosts/db.ts. Коротко: `typikon` целиком накатывается
// с нашей машины (`release-db.sh`, `mongorestore --drop`), а посты заводятся на
// проде. Пока они лежали в `typikon`, каждая выкладка корпуса стирала
// подготовленные черновики, и до своего часа они не доживали.
//
// Запускать НА СЕРВЕРЕ и до первой выкладки новым кодом — иначе выкладка унесёт
// исходную коллекцию раньше, чем её успеют перечитать:
//
//   npm run channel-posts:move -- --dry     — только показать, что где лежит
//   npm run channel-posts:move              — перенести и убрать исходную
//
// Повторный запуск безвреден: перенесённого в `typikon` уже нет.

const dry = process.argv.includes("--dry");

const main = async () => {
    const client = await clientPromise;
    const from = client.db("typikon");
    const to = client.db("typikon-users");

    // Обращаться к несуществующей коллекции Mongo позволяет и молча отдаёт
    // пусто, а нам надо отличать «пусто» от «уже переехало» — иначе отчёт врёт
    // про сделанную работу.
    const present = (await from.listCollections({ name: CHANNEL_POSTS }, { nameOnly: true }).toArray()).length > 0;

    if (!present) {
        console.log(`${CHANNEL_POSTS}: в typikon нет — уже переехало`);
        return;
    }

    const docs = await from.collection(CHANNEL_POSTS).find({}).toArray();
    const there = await to.collection(CHANNEL_POSTS).countDocuments();
    console.log(`${CHANNEL_POSTS}: в typikon ${docs.length}, в typikon-users ${there}`);

    if (dry) {
        console.log("это была примерка (--dry), ничего не тронуто");
        return;
    }

    let moved = 0;
    let conflicts = 0;

    for (const doc of docs) {
        // НЕ ПЕРЕЗАПИСЫВАЕМ. Если запись с тем же _id уже на новом месте, она
        // там свежее: сайт уже пишет туда, а здесь лежит слепок «до». Затереть
        // её значило бы вернуть посту прежнее состояние — например снова
        // объявить черновиком уже опубликованное.
        const exists = await to.collection(CHANNEL_POSTS).countDocuments({ _id: doc._id }, { limit: 1 });
        if (exists) {
            conflicts += 1;
            console.log(`  ${String(doc._id)}: уже на новом месте, оставлено как есть`);
            continue;
        }
        await to.collection(CHANNEL_POSTS).insertOne(doc);
        moved += 1;
    }

    await from.collection(CHANNEL_POSTS).drop();
    console.log(`перенесено записей: ${moved}`
        + (conflicts ? `, оставлено на новом месте: ${conflicts}` : "")
        + "; исходная коллекция убрана из typikon");
};

main()
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(async () => { (await clientPromise).close(); });
