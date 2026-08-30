// Пересчёт канонических ссылок у стихов Библии по текущим правилам приведения.
//
// Зачем отдельно от переноса. Правила (@/lib/bible/mappings) будут дополняться:
// сверка нашла 246 глав, где издания расходятся, и часть из них ещё разбирать.
// Каждое новое правило надо применить ко всем стихам издания разом — иначе
// половина книги искалась бы по новому месту, а половина по старому.
//
// Раньше это делал повторный прогон переноса, но перенос читает старые коллекции
// books/texts/verses, а их больше нет. Этот скрипт читает и пишет только
// bible_verses: родная нумерация стиха в нём уже есть, а канон из неё выводится
// правилами — ровно то, что нужно.
//
// Идемпотентный: без изменившихся правил не трогает ни одного документа.
//
// Запуск:
//   npx tsx src/scripts/recompute-bible-canon.ts           # показать, что изменится
//   npx tsx src/scripts/recompute-bible-canon.ts --apply   # пересчитать
import "@/scripts/lib/env";
import { AnyBulkWriteOperation, Document } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { canonSort, formatCanonRef } from "@/lib/bible/refs";
import { mappingsFor, toCanonRef } from "@/lib/bible/mappings";
import { BibleBook, BibleEdition, BIBLE_BOOKS, BIBLE_EDITIONS, BIBLE_VERSES } from "@/lib/bible/schema";

const APPLY = process.argv.includes("--apply");
const BATCH = 2000;

const main = async () => {
    const db = (await clientPromise).db("typikon");

    if (!APPLY) console.log("ПЛАН (без --apply в базу ничего не пишется)\n");

    const editions = await db.collection(BIBLE_EDITIONS).find({}).sort({ order: 1 }).toArray() as BibleEdition[];

    for (const edition of editions) {
        const mapping = mappingsFor(edition.code);
        const books = await db.collection(BIBLE_BOOKS).find({ editionId: edition._id }).toArray() as BibleBook[];
        const slugOf = new Map(books.map((book) => [book._id.toString(), book.slug]));

        const verses = await db.collection(BIBLE_VERSES).find({ editionId: edition._id }).toArray();

        const ops: AnyBulkWriteOperation<Document>[] = [];
        const examples: string[] = [];

        for (const verse of verses) {
            const slug = slugOf.get(verse.bookId.toString());
            if (!slug) {
                console.warn(`!! стих ${verse._id} ссылается на книгу, которой нет — пропускаю`);
                continue;
            }

            const ref = toCanonRef(mapping, slug, verse.chapter, verse.verse);
            const canonRef = formatCanonRef(ref.canonId, ref.chapter, ref.verse);
            if (canonRef === verse.canonRef && ref.canonId === verse.canonId) continue;

            if (examples.length < 8) {
                examples.push(`${slug} ${verse.chapter}:${verse.verse}: ${verse.canonRef} → ${canonRef}`);
            }

            ops.push({
                updateOne: {
                    filter: { _id: verse._id },
                    update: {
                        $set: {
                            canonId: ref.canonId,
                            canonChapter: ref.chapter,
                            canonVerse: ref.verse,
                            canonRef,
                            canonSort: canonSort(ref.chapter, ref.verse),
                            updatedAt: new Date(),
                        },
                    },
                },
            });
        }

        console.log(`${edition.code}: правил — ${mapping.length}, стихов — ${verses.length}, меняется — ${ops.length}`);
        examples.forEach((line) => console.log(`    ${line}`));

        if (!APPLY || !ops.length) continue;

        for (let i = 0; i < ops.length; i += BATCH) {
            await db.collection(BIBLE_VERSES).bulkWrite(ops.slice(i, i + BATCH), { ordered: false });
        }
        console.log(`  пересчитано: ${ops.length}`);
    }

    if (APPLY) {
        console.log("\nПроверить итог: npx tsx src/scripts/verify-bible-migration.ts");
    }
};

main().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
});
