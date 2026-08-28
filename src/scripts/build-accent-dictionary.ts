// Собирает словарь ударений по собственному корпусу и кладёт его файлом.
//
// Что это такое. Два миллиона ударных словоформ, размеченных вручную за годы
// набора, — самый крупный собственный актив собрания после самих текстов. До сих
// пор он существовал только внутри текстов: чтобы им воспользоваться, каждый скрипт
// заново перебирал весь корпус (полминуты) и заново решал, что считать ударением.
// Этот файл делает из него данные: основа -> где стоит ударение и сколько раз так
// написано.
//
// Ключ — слово без надстрочной разметки. Значение — варианты УДАРЕНИЯ, а не
// написания: «а́дова» и «а҆́дова» различаются звательцем, ударение в них одно и то же,
// и разночтением их считать нельзя (на такой группировке снимается 1408 ложных
// разночтений). Каждый вариант — [номер ударной гласной, знак, частота, написание].
//
//   "глаголет": [[1, "́", 1099, "глаго́лет"]]
//   "руку":     [[0, "́", 173, "ру́ку"], [1, "́", 138, "руку́"]]
//
// Файл воспроизводим: ни времени сборки, ни путей внутрь не пишется, поэтому две
// сборки на одной базе дают побайтово одинаковый результат и его можно сравнивать.
//
// ВНИМАНИЕ: это словарь ТОЛЬКО по корпусу. Публичный словарь собирает и выкладывает
// npm run accents:load (корпус плюс словарь церковнославянского), и именно он совпадает
// с тем, что отдаёт /api/v2/accents. Этот скрипт остаётся отдельно как взгляд на один
// корпус — им удобно мерить сам корпус, не смешивая с чужими данными.
//
// ВАЖНО: каталог script-data целиком в .gitignore, то есть файл остаётся локальным.
// Чтобы словарь можно было выкладывать (пункт 5 плана — раздел публичного API),
// его придётся либо положить в отслеживаемый каталог, либо загружать в Mongo и
// возить вместе с базой. Решение за владельцем: это меняет и релиз, и то, что
// проект отдаёт наружу.
//
// Запуск:
//   npm run accents:build                       # script-data/accents.json
//   npm run accents:build -- --out путь.json    # другой путь
//   npm run accents:build -- --pretty           # с отступами, вчетверо больше
import "@/scripts/lib/env";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import clientPromise from "@/lib/mongodb";
import { readChurchSlavonicCorpus } from "@/scripts/lib/corpus";
import {
    addContent,
    createDraft,
    DOMINANCE,
    finalize,
    KAMORA,
    OXIA,
    VARIA,
} from "@/lib/accents/core";

const outArg = process.argv.indexOf("--out");
const OUT = outArg > 0 ? process.argv[outArg + 1] : "script-data/accents.json";
const PRETTY = process.argv.includes("--pretty");

const MARK_NAMES: Record<string, string> = { [OXIA]: "оксия", [VARIA]: "вария", [KAMORA]: "камора" };

async function main() {
    const client = await clientPromise;
    const db = client.db("typikon");

    console.log("Читаю корпус…");
    const corpus = await readChurchSlavonicCorpus(db);

    const draft = createDraft();
    for (const doc of corpus.docs) addContent(draft, doc.content);
    const dictionary = finalize(draft);

    // Сколько основ отвечают на вопрос «где ударение» однозначно, сколько — с
    // явным перевесом одного варианта, а сколько несут настоящее разночтение.
    const confidence = { sure: 0, likely: 0, unsure: 0 };
    const marks: Record<string, number> = {};
    let variants = 0;
    let occurrences = 0;

    const words: Record<string, [number, string, number, string][]> = {};

    for (const [key, list] of [...dictionary].sort((a, b) => a[0].localeCompare(b[0], "ru"))) {
        words[key] = list.map((variant) => [variant.index, variant.mark, variant.count, variant.spelling]);

        variants += list.length;
        list.forEach((variant) => {
            occurrences += variant.count;
            marks[variant.mark] = (marks[variant.mark] ?? 0) + variant.count;
        });

        if (list.length === 1) confidence.sure++;
        else if (list[0].count >= DOMINANCE * list[1].count) confidence.likely++;
        else confidence.unsure++;
    }

    const payload = {
        meta: {
            about: "Словарь ударений церковнославянского корпуса typikon.su. "
                + "Ключ — слово без надстрочной разметки; значение — варианты ударения "
                + "[номер ударной гласной, знак, частота, написание].",
            corpus: {
                texts: corpus.texts,
                verses: corpus.verses,
                excluded: "Библия на румынской (валашской) кириллице — другая орфография",
            },
            words: dictionary.size,
            variants,
            occurrences,
            confidence,
            marks: Object.fromEntries(
                Object.entries(marks).map(([mark, n]) => [MARK_NAMES[mark] ?? mark, n]),
            ),
            license: "Корпус — CC BY 4.0, см. LICENSE-CORPUS.md",
        },
        words,
    };

    mkdirSync(dirname(OUT), { recursive: true });
    const json = PRETTY ? JSON.stringify(payload, null, 1) : JSON.stringify(payload);
    writeFileSync(OUT, json, "utf8");

    console.log(`\nОснов: ${dictionary.size}`);
    console.log(`  однозначных: ${confidence.sure}`);
    console.log(`  с явным перевесом одного варианта: ${confidence.likely}`);
    console.log(`  с настоящим разночтением: ${confidence.unsure}`);
    console.log(`Ударных вхождений: ${occurrences}`);
    Object.entries(payload.meta.marks).forEach(([name, n]) => console.log(`  ${name}: ${n}`));
    // Именно байты, а не символы: кириллица в UTF-8 занимает по два байта,
    // и длина строки в JS занижает размер файла вдвое.
    const bytes = Buffer.byteLength(json, "utf8");
    console.log(`\nЗаписано: ${OUT}, ${(bytes / 1e6).toFixed(1)} МБ`);
    console.log(`Каталог script-data в .gitignore — файл остаётся локальным.`);

    process.exit(0);
}

main();
