// Приводит текст издания Библии к NFC.
//
// ЗАЧЕМ. Одно и то же ударение юникод записывает двояко: «ά» — это и U+1F71
// (оксия, блок Greek Extended), и U+03AC (тонос). Знаки «с оксией» объявлены
// каноническими ДУБЛИКАТАМИ: у них сингулярное разложение, они исключены из
// композиции и заведены лишь ради обратимости со старыми кодировками. NFC их
// сворачивает, и это рекомендованная форма обмена (W3C, UAX #15); в ней держат
// тексты Perseus и First1KGreek.
//
// Пока половины греческого издания были записаны по-разному — Ветхий Завет оксией,
// Новый тоносом, как отдаёт eBible, — всякое сравнение без нормализации считало
// одинаковое разным. На этом дважды споткнулась правка Пс. 118:127.
//
// ПОЛИТОНИКА НЕ СТРАДАЕТ. Сворачиваются только дубликаты оксии (их восемь видов в
// нашем корпусе). Гравис «ὰ», придыхания «ἀ», ипогегрименная «ᾳ» остаются своими
// знаками: дубликатов в базовом блоке у них нет, и NFC их не трогает.
//
// ЧЕМ ЭТО ПРОВЕРЯЕТСЯ. NFD до и после обязан совпасть до знака: это и значит, что
// текст канонически тот же, а изменилась только запись. Стих, не прошедший
// проверку, не пишется, и прогон останавливается.
//
// ДЛИНА — ОТДЕЛЬНЫЙ РАЗГОВОР. У греческого NFC не меняет длину ни одного стиха:
// один знак заменяется одним. У румынского издания меняются все 33 484 — там NFC
// СОБИРАЕТ надстрочные знаки с буквой, и это правка другого рода и другого риска
// (её задевает разметка ударений). Поэтому такие издания требуют
// --allow-length-change: молча пересобрать текст, на который завязаны наши же
// инструменты, нельзя.
//
// Запуск:
//   npm run bible:normalize -- grc-lxx-pat              # показать, что изменится
//   npm run bible:normalize -- grc-lxx-pat --apply      # привести
import "@/scripts/lib/env";
import { AnyBulkWriteOperation, Document } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { BIBLE_EDITIONS, BIBLE_VERSES } from "@/lib/bible/schema";

const APPLY = process.argv.includes("--apply");
const ALLOW_LENGTH = process.argv.includes("--allow-length-change");
const CODE = process.argv.slice(2).find((arg) => !arg.startsWith("--"));

const main = async () => {
    if (!CODE) {
        console.error("Не сказано, какое издание приводить. Например:");
        console.error("  npm run bible:normalize -- grc-lxx-pat");
        process.exit(1);
    }

    const client = await clientPromise;
    const db = client.db("typikon");
    const edition = await db.collection(BIBLE_EDITIONS).findOne({ code: CODE });
    if (!edition) {
        console.error(`Издания ${CODE} в базе нет`);
        process.exit(1);
    }

    const ops: AnyBulkWriteOperation<Document>[] = [];
    const changedChars = new Map<string, number>();
    let total = 0;
    let lengthChanged = 0;

    for await (const verse of db.collection(BIBLE_VERSES).find({ editionId: edition._id })) {
        total++;
        const content: string = verse.content || "";
        const normalized = content.normalize("NFC");
        if (normalized === content) continue;

        // Канонически тот же текст — или не пишем вовсе.
        if (normalized.normalize("NFD") !== content.normalize("NFD")) {
            console.error(`${verse.canonRef}: NFC изменил СОДЕРЖАНИЕ, а не запись — останавливаюсь`);
            process.exit(1);
        }

        if (normalized.length !== content.length) lengthChanged++;

        [...content].forEach((ch) => {
            const one = ch.normalize("NFC");
            if (one === ch) return;
            const key = `${ch} U+${ch.codePointAt(0)!.toString(16).toUpperCase()}`
                + ` -> ${one} U+${one.codePointAt(0)!.toString(16).toUpperCase()}`;
            changedChars.set(key, (changedChars.get(key) ?? 0) + 1);
        });

        ops.push({
            updateOne: {
                filter: { _id: verse._id },
                update: { $set: { content: normalized, updatedAt: new Date() } },
            },
        });
    }

    console.log(`${CODE}: стихов ${total}, приводится ${ops.length}`);
    [...changedChars.entries()].sort((a, b) => b[1] - a[1])
        .forEach(([key, n]) => console.log(`  ${key}  ×${n}`));

    if (lengthChanged) {
        console.log(`\nМЕНЯЮТ ДЛИНУ: ${lengthChanged} стихов — здесь NFC не заменяет знак`);
        console.log("на равный, а СОБИРАЕТ надстрочные знаки с буквой. Это правка другого");
        console.log("рода: на такой текст завязана разметка ударений.");
        if (!ALLOW_LENGTH) {
            console.log("Если это и нужно — повторите с --allow-length-change.");
            await client.close();
            return;
        }
    }

    if (!ops.length) {
        console.log("Уже в NFC, менять нечего.");
        await client.close();
        return;
    }

    if (!APPLY) {
        console.log("\nПЛАН: без --apply в базу ничего не записано");
        await client.close();
        return;
    }

    for (let i = 0; i < ops.length; i += 2000) {
        await db.collection(BIBLE_VERSES).bulkWrite(ops.slice(i, i + 2000), { ordered: false });
    }
    console.log("\nЗаписано. Не забудь сбросить кэш выборок: POST /api/revalidate");
    await client.close();
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
