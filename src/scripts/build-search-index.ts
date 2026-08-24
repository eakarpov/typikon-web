// Заполняет searchName/searchContent у текстов и пересобирает текстовый индекс.
//
// Зачем: до этого текстовый индекс стоял только на texts.name, и 12,7 млн символов
// содержимого не искались вовсе — человек, помнящий фразу, но не название, найти текст
// не мог. Искать по самому content нельзя: ударение стоит внутри слова отдельным
// символом, поэтому «стражи» не совпадает со «стра́жи». Подробнее — в @/lib/search.
//
// Индекс пересоздаётся здесь, а не в ensure-indexes: текстовый индекс в коллекции может
// быть только ОДИН, поэтому старый name_text нужно снять, а сделать это вслепую в общем
// цикле по индексам — плохая идея.
//
// Запускать после массовых импортов текстов; при правке через админку поля
// обновляются сами (см. buildSearchFields в обработчиках admin/texts).
//
// Запуск:
//   npx tsx src/scripts/build-search-index.ts           # план
//   npx tsx src/scripts/build-search-index.ts --apply   # заполнить и пересобрать индекс
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { buildSearchFields } from "@/lib/search";

const APPLY = process.argv.includes("--apply");

const INDEX_NAME = "search_text";

async function main() {
    const client = await clientPromise;
    const db = client.db("typikon");
    const texts = db.collection("texts");

    const total = await texts.countDocuments();
    const stale = await texts.countDocuments({ searchContent: { $exists: false } });
    console.log(`Текстов: ${total}, без поисковых полей: ${stale}`);

    if (!APPLY) {
        const sample = await texts.findOne({ content: { $type: "string", $ne: "" } }, { projection: { name: 1, content: 1 } });
        if (sample) {
            const fields = buildSearchFields(sample as any);
            console.log(`\nПример нормализации:`);
            console.log(`  было:  ${(sample.content as string).slice(0, 90).replace(/\s+/g, " ")}`);
            console.log(`  стало: ${fields.searchContent.slice(0, 90)}`);
        }
        console.log(`\nНичего не изменено. Для записи: --apply`);
        process.exit(0);
    }

    console.log(`\nЗаполняю поисковые поля...`);
    const cursor = texts.find({}, { projection: { name: 1, content: 1, description: 1, author: 1, translator: 1, poems: 1 } });
    let done = 0;
    let bulk: any[] = [];

    const flush = async () => {
        if (!bulk.length) return;
        await texts.bulkWrite(bulk, { ordered: false });
        bulk = [];
    };

    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        if (!doc) break;
        bulk.push({
            updateOne: {
                filter: { _id: doc._id },
                update: { $set: buildSearchFields(doc as any) },
            },
        });
        done++;
        if (bulk.length >= 200) {
            await flush();
            console.log(`  ...${done}/${total}`);
        }
    }
    await flush();
    console.log(`Заполнено: ${done}`);

    // Текстовый индекс в коллекции только один — снимаем старый по названию.
    const existing = await texts.indexes();
    for (const index of existing) {
        if (index.key?._fts === "text" && index.name !== INDEX_NAME) {
            console.log(`Снимаю прежний текстовый индекс: ${index.name}`);
            await texts.dropIndex(index.name!);
        }
    }

    const hasIndex = (await texts.indexes()).some((i) => i.name === INDEX_NAME);
    if (!hasIndex) {
        console.log(`Собираю индекс ${INDEX_NAME} (название весит больше содержимого)...`);
        const started = Date.now();
        await texts.createIndex(
            { searchName: "text", searchContent: "text" } as any,
            {
                name: INDEX_NAME,
                weights: { searchName: 10, searchContent: 1 },
                default_language: "russian",
            },
        );
        console.log(`Готово за ${Math.round((Date.now() - started) / 1000)} с`);
    } else {
        console.log(`Индекс ${INDEX_NAME} уже есть`);
    }

    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
