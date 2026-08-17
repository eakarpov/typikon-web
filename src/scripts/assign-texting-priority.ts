// Страница /texting показывает только тексты с readiness IN [presence, absence] И textingPriority != null
// (см. src/app/texting/api.ts) — то есть readiness сам по себе на попадание в очередь не влияет,
// нужен ещё явно выставленный приоритет. Этот скрипт проставляет textingPriority всем текстам
// readiness=presence, у которых он ещё не задан, чтобы они появились на /texting.
//
// Порядок приоритета — сквозной счётчик по книгам (в порядке books.order), внутри книги —
// по bookIndex (тексты без bookIndex — в конец книги), чтобы очередь на /texting шла в разумном
// читательском порядке, а не вперемешку.
//
// Идемпотентно: трогает только документы с textingPriority: null, повторный запуск ничего не меняет.
// Запуск: npx tsx src/scripts/assign-texting-priority.ts
//         DRY_RUN=1 npx tsx src/scripts/assign-texting-priority.ts
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { TextReadiness } from "@/utils/texts";

const DRY_RUN = process.env.DRY_RUN === "1";

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");
    const booksCol = db.collection("books");
    const textsCol = db.collection("texts");

    const books = await booksCol.find({}).sort({ order: 1 }).toArray();

    let priority = 1;
    let totalUpdated = 0;
    const bulkOps: any[] = [];

    for (const book of books) {
        const texts = await textsCol
            .find({ bookId: book._id, readiness: TextReadiness.PRESENCE, textingPriority: null })
            .toArray();
        if (texts.length === 0) continue;

        texts.sort((a, b) => {
            const ai = typeof a.bookIndex === "number" ? a.bookIndex : Number.MAX_SAFE_INTEGER;
            const bi = typeof b.bookIndex === "number" ? b.bookIndex : Number.MAX_SAFE_INTEGER;
            if (ai !== bi) return ai - bi;
            return (a.name || "").localeCompare(b.name || "", "ru");
        });

        for (const t of texts) {
            bulkOps.push({ updateOne: { filter: { _id: t._id }, update: { $set: { textingPriority: priority } } } });
            priority += 1;
        }

        console.log(`${DRY_RUN ? "[DRY] " : ""}${book.name}: ${texts.length} текстов получат приоритет`);
        totalUpdated += texts.length;
    }

    // Тексты readiness=presence без привязки к найденной книге (на случай осиротевших записей) —
    // не должно встречаться, но на всякий случай подчищаем и их, в конец очереди.
    const orphan = await textsCol
        .find({ readiness: TextReadiness.PRESENCE, textingPriority: null, bookId: { $nin: books.map(b => b._id) } })
        .toArray();
    for (const t of orphan) {
        bulkOps.push({ updateOne: { filter: { _id: t._id }, update: { $set: { textingPriority: priority } } } });
        priority += 1;
    }
    if (orphan.length > 0) {
        console.log(`${DRY_RUN ? "[DRY] " : ""}(без известной книги): ${orphan.length} текстов получат приоритет`);
        totalUpdated += orphan.length;
    }

    if (!DRY_RUN && bulkOps.length > 0) {
        await textsCol.bulkWrite(bulkOps);
    }

    console.log(`\nИтого: ${DRY_RUN ? "будет обновлено" : "обновлено"} ${totalUpdated} текстов (textingPriority 1..${totalUpdated})`);
};

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
