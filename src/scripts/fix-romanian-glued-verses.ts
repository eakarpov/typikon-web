// Румынская 1688: стихи, слипшиеся с предыдущим, — разделить обратно.
//
// ЧТО БЫЛО НЕ ТАК. Румынский набор печатает номера стихов кириллической цифирью
// («.ѳ҃і» — 19, «.м҃д» — 44, «р҃кѳ» — 129). Сборщик текста опознал не всякую, и
// там, где не опознал, следующий стих прирос к предыдущему вместе со своим
// номером. В сверке версификации это выглядело дырой: у главы недостаёт стиха,
// хотя текст его на месте, внутри соседа.
//
// Так вышло в 28 главах по всей книге — от Псалтири (в 118-м псалме семь таких)
// до Иоанна, Римлянам и Евреям.
//
// ПОЧЕМУ ЧИНИТСЯ ЗДЕСЬ, А НЕ В РАЗБОРЕ. Та же склейка лежит и в источнике,
// romanian/output/bible_cyrillic.json, — значит родилась она ещё в сборщике
// текста, которого в этих двух репозиториях нет. Перебрать заново нечем: цепочка
// импорта читает коллекции `texts`/`verses`, снятые drop-legacy-bible.ts.
// Зато починка ОДНОЗНАЧНА: номер стоит в тексте, его надо лишь прочесть.
//
// ЧЕМ ЗАЩИЩЁН РЕЗ. Делим только там, где нашлась цифирь ПОД ТИТЛОМ, равная
// ровно ожидаемому номеру. Без титла «ми» — предлог, а не 48; без сверки со
// ожидаемым числом можно разрезать по случайному совпадению. Не нашлось —
// оставляем как есть и говорим об этом вслух: молчаливая догадка тут хуже дыры.
//
// После него нужен пересчёт канонических ссылок:
//   npx tsx src/scripts/recompute-bible-canon.ts --apply
//
// Запуск:
//   npx tsx src/scripts/fix-romanian-glued-verses.ts
//   npx tsx src/scripts/fix-romanian-glued-verses.ts --apply
import "@/scripts/lib/env";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { splitAtNumeral } from "@/utils/cyrillicNumeral";
import { canonSort, formatCanonRef } from "@/lib/bible/refs";
import { mappingsFor, toCanonRef } from "@/lib/bible/mappings";
import { BIBLE_BOOKS, BIBLE_EDITIONS, BIBLE_VERSES } from "@/lib/bible/schema";

const APPLY = process.argv.includes("--apply");
const EDITION = "ro-1688";

const main = async () => {
    const db = (await clientPromise).db("typikon");
    const edition = await db.collection(BIBLE_EDITIONS).findOne({ code: EDITION });
    if (!edition) { console.log(`издания «${EDITION}» нет`); process.exit(1); }
    const mapping = mappingsFor(EDITION);

    const books = await db.collection(BIBLE_BOOKS).find({ editionId: edition._id }).toArray();
    let split = 0, missed = 0;
    const unresolved: string[] = [];

    for (const book of books) {
        const verses = await db.collection(BIBLE_VERSES)
            .find({ bookId: book._id }).sort({ chapter: 1, verse: 1 }).toArray();
        const byChapter = new Map<number, Map<number, any>>();
        verses.forEach((v) => {
            const ch = v.chapter as number;
            if (!byChapter.has(ch)) byChapter.set(ch, new Map());
            byChapter.get(ch)!.set(v.verse as number, v);
        });

        for (const [chapter, rows] of byChapter) {
            const max = Math.max(...rows.keys());
            for (let n = 2; n <= max; n++) {
                if (rows.has(n)) continue;
                // Прирос к предыдущему — ищем там его номер.
                let host = n - 1;
                while (host >= 1 && !rows.has(host)) host--;
                const donor = host >= 1 ? rows.get(host) : null;
                if (!donor) { missed++; continue; }

                const cut = splitAtNumeral(donor.content as string, n);
                if (!cut) {
                    missed++;
                    unresolved.push(`${book.slug} ${chapter}:${n}`);
                    continue;
                }

                const ref = toCanonRef(mapping, book.slug as string, chapter, n);
                const fresh = {
                    _id: new ObjectId(),
                    editionId: edition._id,
                    bookId: book._id,
                    canonId: ref.canonId,
                    chapter, verse: n,
                    canonChapter: ref.chapter, canonVerse: ref.verse,
                    canonRef: formatCanonRef(ref.canonId, ref.chapter, ref.verse),
                    canonSort: canonSort(ref.chapter, ref.verse),
                    content: cut.after,
                    updatedAt: new Date(),
                };
                if (split < 8) {
                    console.log(`  ${book.slug} ${chapter}:${host} → ${chapter}:${n}`);
                    console.log(`      было …${(donor.content as string).slice(-70)}`);
                    console.log(`      стал …${cut.before.slice(-40)}  ||  ${cut.after.slice(0, 40)}…`);
                }
                if (APPLY) {
                    await db.collection(BIBLE_VERSES)
                        .updateOne({ _id: donor._id }, { $set: { content: cut.before, updatedAt: new Date() } });
                    await db.collection(BIBLE_VERSES).insertOne(fresh);
                }
                donor.content = cut.before;
                rows.set(n, fresh);
                split++;
            }
        }
    }

    console.log(`\nразделено: ${split}`);
    if (missed) {
        console.log(`не поддалось: ${missed} — цифири под титлом на месте не нашлось`);
        unresolved.slice(0, 20).forEach((s) => console.log(`   ${s}`));
    }
    console.log(APPLY
        ? "\nготово; пересчитай ссылки: npx tsx src/scripts/recompute-bible-canon.ts --apply"
        : "\nПЛАН: без --apply в базу ничего не записано");
    process.exit(0);
};

main();
