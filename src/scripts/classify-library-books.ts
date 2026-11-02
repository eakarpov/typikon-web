// Проверенная вручную разметка по выборочным фрагментам. По умолчанию — отчёт;
// --apply сохраняет только language/category, с резервной копией прежних полей.
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { mkdirSync, writeFileSync } from "node:fs";
import { revalidateTags } from "@/scripts/lib/revalidate";
import classification from "@/data/library/classification-2026-11-01.json";
import { BOOK_CATEGORIES } from "@/utils/libraryBooks";
import { BOOK_LANGUAGES } from "@/utils/bookLanguages";

async function main() {
    const apply = process.argv.includes("--apply");
    const client = await clientPromise;
    try {
        const books = client.db("typikon").collection("books");
        const backup = [];
        const changes = [];
        for (const row of classification) {
            if (!Object.hasOwn(BOOK_CATEGORIES, row.category) || !BOOK_LANGUAGES.some(l => l.code === row.language)) {
                throw new Error(`Неизвестная маркировка: ${row.name}`);
            }
            const book = await books.findOne({ _id: new ObjectId(row.id) }, { projection: { name: 1, language: 1, category: 1, updatedAt: 1 } });
            if (!book) throw new Error(`Не найдена книга: ${row.name}`);
            if (book.language === row.language && book.category === row.category) continue;
            // Не перетираем изменения редактора после подготовки разметки.
            if ((book.language ?? null) !== row.previousLanguage && book.language !== row.language) {
                throw new Error(`Язык уже изменён редактором: ${row.name}`);
            }
            if ((book.category ?? null) !== row.previousCategory && book.category !== row.category) {
                throw new Error(`Тематика уже изменена редактором: ${row.name}`);
            }
            backup.push(book);
            changes.push({ book, row });
            console.log(`${row.name}: ${book.language || "—"} → ${row.language}; ${BOOK_CATEGORIES[row.category]}${row.reviewed ? "" : " (текста нет)"}`);
        }
        if (apply && changes.length) {
            mkdirSync("scratch", { recursive: true });
            const path = `scratch/library-classification-backup-${Date.now()}.json`;
            writeFileSync(path, JSON.stringify(backup, null, 2) + "\n");
            console.log(`Резервная копия: ${path}`);
            for (const { book, row } of changes) {
                const result = await books.updateOne({
                    _id: book._id,
                    language: book.language ?? null,
                    category: book.category ?? null,
                }, { $set: { language: row.language, category: row.category, updatedAt: new Date() } });
                if (result.matchedCount !== 1) throw new Error(`Конкурентное изменение: ${row.name}`);
            }
            for (const row of classification) {
                const found = await books.findOne({ _id: new ObjectId(row.id), language: row.language, category: row.category });
                if (!found) throw new Error(`Не прошла проверка после записи: ${row.name}`);
            }
        }
        if (apply) await revalidateTags(["books"]);
        console.log(`${apply ? "Сохранено" : "К изменению"}: ${changes.length}; всего проверено: ${classification.length}.`);
        if (!apply) console.log("Для сохранения запустите с --apply.");
    } finally {
        await client.close();
    }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
