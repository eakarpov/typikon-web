// Заводит «Алфавит духовный» святителя Димитрия Ростовского из исходных файлов HIP.
//
// Источник: оцифровка Александра Акимова (spiritalph.narod.ru), по изданию
// Московского Сретенского монастыря, «Правило Веры», 1997, ISBN 5-7533-0054-5.
// Само сочинение († 1709) — общественное достояние; условий использования
// оцифровки на сайте не заявлено.
//
// Формат: по файлу на главу, CP1251, восьмибитный HIP — надстрочные знаки записаны
// ASCII, варианты букв через подчёркивание. Приводится к юникоду ступенью hip8
// в lib/hip.ts, дальше идёт та же чистка, что у прочих текстов orthlib.
//
// Названия глав берутся из info.txt в самом архиве, а не угадываются.
//
// Запуск:
//   npx tsx src/scripts/import-alfavit.ts --dir=<путь к каталогу alfavit>
//   npx tsx src/scripts/import-alfavit.ts --dir=<...> --apply
import "@/scripts/lib/env";
import fs from "fs";
import path from "path";
import clientPromise from "@/lib/mongodb";
import { buildSearchFields } from "@/lib/search";
import { revalidateContent } from "@/scripts/lib/revalidate";
import { normalizeHip, type Stats } from "@/scripts/lib/hip";

const APPLY = process.argv.includes("--apply");
const DIR = process.argv.find((a) => a.startsWith("--dir="))?.slice("--dir=".length);

const BOOK_ID = "6982670e3eb449fef879dac3"; // книга «Алфавит Духовный», сейчас пустая
const ALIAS_PREFIX = "alfavit-duhovny";

const decode = (file: string) => new TextDecoder("windows-1251").decode(fs.readFileSync(file));

// info.txt перечисляет файлы с названиями: «101.hip -- Глава` пе'рвая. W= _е='же …»
const readTitles = (dir: string): Map<string, string> => {
    const titles = new Map<string, string>();
    const info = decode(path.join(dir, "info.txt")).replace(/\r/g, "");
    for (const m of info.matchAll(/^(\d+)\.hip\s*--\s*([\s\S]*?)(?=\n\s*\n|\n\d+\.hip|$)/gm)) {
        titles.set(m[1], m[2].replace(/\s+/g, " ").trim());
    }
    return titles;
};

// Заголовок тоже в HIP, его надо привести к юникоду тем же способом.
const cleanTitle = (raw: string) => {
    const { content } = normalizeHip(raw, { hip8: true });
    return content.replace(/\s+/g, " ").replace(/[.,;:]+$/, "").trim();
};

const LEFTOVERS: [string, RegExp][] = [
    ["ударение '", /'/g],
    ["звательце =", /=/g],
    ["титло ~", /~/g],
    ["подчёркивание", /_/g],
    ["латиница", /[A-Za-z]/g],
    ["слэш", /[\\@]/g],
];

async function main() {
    if (!DIR || !fs.existsSync(DIR)) {
        console.log("Укажите каталог: --dir=<путь к распакованному alfavit>");
        process.exit(1);
    }

    const titles = readTitles(DIR);
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".hip")).sort();
    console.log(`Файлов: ${files.length}, названий в info.txt: ${titles.size}\n`);

    const total: Stats = {};
    const planned: { alias: string; name: string; content: string; footnotes: string[]; raw: string }[] = [];

    for (const file of files) {
        const number = file.replace(".hip", "");
        const raw = decode(path.join(DIR, file));
        const { content, footnotes, stats } = normalizeHip(raw, { hip8: true });
        for (const [k, v] of Object.entries(stats)) total[k] = (total[k] ?? 0) + v;

        const name = titles.has(number) ? cleanTitle(titles.get(number)!) : "(нет названия в info.txt)";
        const left = LEFTOVERS
            .map(([label, re]) => [label, (content.replace(/\{p\|[^}]*\}/g, "").match(re) ?? []).length] as const)
            .filter(([, n]) => n);

        console.log(
            `  ${number}  ${String(raw.length).padStart(6)} -> ${String(content.length).padStart(6)} зн.` +
            `  абз. ${String(content.split(/\n\s*\n/).length).padStart(3)}` +
            (left.length ? `  ОСТАЛОСЬ: ${left.map(([l, n]) => `${l} ${n}`).join(", ")}` : "") +
            `  ${name.slice(0, 64)}`,
        );

        planned.push({ alias: `${ALIAS_PREFIX}-${planned.length + 1}`, name, content, footnotes, raw });
    }

    console.log(`\nИтого замен: ${Object.entries(total).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`);
    console.log(`Знаков после чистки: ${planned.reduce((s, p) => s + p.content.length, 0)}`);
    console.log(`\nПример начала первой главы:\n${planned.find((p) => p.alias.endsWith("-5"))?.content.slice(0, 260)}`);

    if (!APPLY) {
        console.log(`\nХолостой прогон, база не тронута. Записать: --apply`);
        process.exit(0);
    }

    const db = (await clientPromise).db("typikon");
    const texts = db.collection("texts");
    const { ObjectId } = await import("mongodb");
    const bookId = new ObjectId(BOOK_ID);

    if (await texts.countDocuments({ bookId })) {
        console.log("В книге уже есть тексты — импорт остановлен, чтобы не задвоить.");
        process.exit(1);
    }

    let bookIndex = 0;
    for (const p of planned) {
        bookIndex += 1;
        const { insertedId } = await texts.insertOne({
            name: p.name,
            alias: p.alias,
            content: p.content,
            description: "",
            start: "",
            fileId: null,
            link: null,
            ruLink: null,
            bookId,
            bookIndex,
            footnotes: p.footnotes,
            // Исходный файл HIP: прогон необратим, а по нему потом сверяется целостность.
            hipSource: p.raw,
            csSource: true,
            newUi: false,
            type: "Teaching",
            readiness: "ready",
            createdAt: new Date(),
            updatedAt: new Date(),
            ...buildSearchFields({ name: p.name, content: p.content } as any),
        });
        await db.collection("books").updateOne({ _id: bookId }, { $addToSet: { texts: insertedId } });
    }

    console.log(`\nСоздано текстов: ${planned.length}`);
    await revalidateContent();
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
