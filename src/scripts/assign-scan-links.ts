// Проставляет поле `link` (ссылка на скан-первоисточник для отекстовки, показывается на /texting
// как "Скан текста") у текстов книг, добавленных через import-content-stubs.ts. Ссылки — на РГБ
// (lib-fond.ru) или НЭБ (rusneb.ru/kp.rusneb.ru), т.е. на факсимиле, а не на уже готовый транскрибированный
// текст (для этого есть отдельное поле ruLink, используемое как справочное издание).
//
// Часть ссылок — присланные пользователем напрямую (приоритетные), часть — найденные отдельным
// поиском по РГБ/НЭБ (см. contents/scan-sources-found.json, если файл существует на момент запуска).
//
// Идемпотентно: только $set, безопасно перезапускать; не трогает link, если он уже совпадает.
// Запуск: npx tsx src/scripts/assign-scan-links.ts
//         DRY_RUN=1 npx tsx src/scripts/assign-scan-links.ts
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import * as fs from "fs";
import * as path from "path";

const DRY_RUN = process.env.DRY_RUN === "1";
const CONTENTS_DIR = path.join(process.cwd(), "contents");

interface IRule {
    bookName: string;
    // Либо один link на всю книгу, либо разбиение по диапазонам bookIndex (напр. два тома скана).
    single?: string;
    ranges?: Array<{ maxIndex: number; url: string }>; // применяется первый диапазон, где bookIndex <= maxIndex
}

const rules: IRule[] = [
    {
        bookName: "Лавсаик",
        single: "https://lib-fond.ru/lib-rgb/310/f-310-220/",
    },
    {
        bookName: "Толковое Евангелие от Луки",
        single: "https://lib-fond.ru/lib-rgb/304-i/f-304i-112/",
    },
    {
        bookName: "Беседы на Бытие",
        ranges: [
            { maxIndex: 32, url: "https://lib-fond.ru/lib-rgb/mk-rgb/svyatitel-ioann-zlatoust-besedy-na-bytie-ch-1/" },
            { maxIndex: Infinity, url: "https://lib-fond.ru/lib-rgb/mk-rgb/svyatitel-ioann-zlatoust-besedy-na-bytie-ch-2/" },
        ],
    },
];

// Если фоновый поиск по РГБ/НЭБ уже отработал и оставил файл — подключаем найденные ссылки для
// остальных книг (см. промпт фонового агента / contents/scan-sources-found.json).
const foundPath = path.join(CONTENTS_DIR, "scan-sources-found.json");
if (fs.existsSync(foundPath)) {
    const found = JSON.parse(fs.readFileSync(foundPath, "utf-8"));
    const map: Record<string, string> = {
        "феофилакт-марка": "Толковое Евангелие от Марка",
        "besedy-matfeya": "Беседы на Евангелие от Матфея",
        "tolkovyy-apostol": "Толковый апостол",
        "apokalipsis": "Толкование на Апокалипсис",
        "torzhestvennik-postnyy": "Торжественник триодный (постный)",
    };
    for (const [key, bookName] of Object.entries(map)) {
        const entry = found[key];
        if (!entry?.found) continue;
        // Формат "url" (одна ссылка) или "urls" (несколько вариантов — берём первый, он же
        // рекомендованный агентом основной вариант, см. note внутри каждого элемента).
        const url = entry.url || entry.urls?.[0]?.url;
        if (url) {
            rules.push({ bookName, single: url });
        }
    }
}

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");
    const booksCol = db.collection("books");
    const textsCol = db.collection("texts");

    let totalUpdated = 0;

    for (const rule of rules) {
        const book = await booksCol.findOne({ name: rule.bookName });
        if (!book) {
            console.warn(`!! книга "${rule.bookName}" не найдена — пропуск`);
            continue;
        }

        const texts = await textsCol.find({ bookId: book._id }).toArray();
        let updatedInBook = 0;

        for (const t of texts) {
            let url: string | undefined;
            if (rule.single) {
                url = rule.single;
            } else if (rule.ranges) {
                const idx = typeof t.bookIndex === "number" ? t.bookIndex : Infinity;
                url = rule.ranges.find(r => idx <= r.maxIndex)?.url;
            }
            if (!url || t.link === url) continue; // уже проставлено или нечего ставить

            if (!DRY_RUN) {
                await textsCol.updateOne({ _id: t._id }, { $set: { link: url } });
            }
            updatedInBook += 1;
        }

        console.log(`${DRY_RUN ? "[DRY] " : ""}${rule.bookName}: обновлено ссылок на скан — ${updatedInBook} из ${texts.length}`);
        totalUpdated += updatedInBook;
    }

    console.log(`\nИтого: ${DRY_RUN ? "будет обновлено" : "обновлено"} ${totalUpdated} текстов`);
};

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
