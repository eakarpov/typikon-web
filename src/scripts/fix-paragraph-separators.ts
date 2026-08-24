// Приводит границы абзацев в текстах к двум переводам строки.
//
// Зачем: в части импортированных текстов между переводами строк стоит пробельный
// символ («\n \n», U+00A0, табуляция, U+2003). И веб, и мобильное приложение делят
// текст по буквальному «\n\n», поэтому такой текст становится одним абзацем на тысячи
// символов: выделение слова и оглавление работают, но контейнер получается размером
// со всё чтение.
//
// Заодно пересобираются поисковые поля затронутых текстов — они строятся из content.
//
// Новые тексты чинятся при сохранении (normalizeParagraphs в обработчиках admin/texts
// и texting/approve), этот скрипт разбирает накопленное.
//
// Запуск:
//   npx tsx src/scripts/fix-paragraph-separators.ts           # что будет исправлено
//   npx tsx src/scripts/fix-paragraph-separators.ts --apply   # исправить
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { normalizeParagraphs } from "@/utils/texts";
import { buildSearchFields } from "@/lib/search";
import { revalidateContent } from "@/scripts/lib/revalidate";

const APPLY = process.argv.includes("--apply");
const SEPARATOR = /\n[^\S\n]+\n/g;

const describe = (content: string) => {
    const found = content.match(SEPARATOR) ?? [];
    const codes = new Map<string, number>();
    for (const match of found) {
        const inner = [...match.slice(1, -1)]
            .map((ch) => `U+${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`)
            .join(",");
        codes.set(inner, (codes.get(inner) ?? 0) + 1);
    }
    return [...codes.entries()].map(([code, n]) => `${code}×${n}`).join(", ");
};

async function main() {
    const client = await clientPromise;
    const texts = client.db("typikon").collection("texts");

    const docs = await texts
        .find({ content: { $type: "string" } },
              { projection: { content: 1, name: 1, description: 1, author: 1, translator: 1, poems: 1 } })
        .toArray();

    const affected = docs.filter((d) => SEPARATOR.test(d.content ?? "") && (SEPARATOR.lastIndex = 0) === 0);

    console.log(`Текстов с содержимым: ${docs.length}`);
    console.log(`Требуют правки: ${affected.length}\n`);

    for (const doc of affected) {
        console.log(`  ${(doc.name ?? "(без названия)").slice(0, 60)} — ${describe(doc.content)}`);
    }

    if (!affected.length) {
        console.log(`\nПравить нечего.`);
        process.exit(0);
    }

    if (!APPLY) {
        console.log(`\nНичего не изменено. Для записи: --apply`);
        process.exit(0);
    }

    let fixed = 0;
    for (const doc of affected) {
        const content = normalizeParagraphs(doc.content);
        await texts.updateOne(
            { _id: doc._id },
            { $set: { content, ...buildSearchFields({ ...doc, content }), updatedAt: new Date() } },
        );
        fixed++;
    }

    console.log(`\nИсправлено текстов: ${fixed}`);
    await revalidateContent();
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
