// Перенос Библий из библиотечных книг в собственные коллекции.
//
// Было: издание — документ в `books` с полем bibleLanguageCode, книга издания —
// документ в `texts` с bibleBookSlug, стих — документ в `verses` с textId.
// Стало: `bible_editions` / `bible_books` / `bible_verses` (@/lib/bible/schema),
// где у каждого стиха есть каноническая ссылка, общая для всех изданий.
//
// ИДЕНТИФИКАТОРЫ СОХРАНЯЮТСЯ. bible_books._id — прежний texts._id, bible_verses._id —
// прежний verses._id. Это не аккуратность ради аккуратности: на texts._id ссылаются
// закладки и заметки читателей (typikon-users), а по verses._id правят ударения
// (@/scripts/lib/corpus). Заведи мы новые идентификаторы — всё это молча отвязалось бы.
//
// СТАРОЕ НЕ ТРОГАЕТ. `books`, `texts` и `verses` остаются как были: пока раздел
// Библии не проверен, откат должен быть откатом кода, а не восстановлением базы.
//
// Скрипт идемпотентный — перезапуск переписывает те же документы. Это важно:
// правила приведения к канону (@/lib/bible/mappings) будут дополняться, и каждое
// дополнение — это повторный прогон, а не миграция поверх миграции.
//
// Запуск:
//   npx tsx src/scripts/migrate-bible.ts           # план, в базу не пишет
//   npx tsx src/scripts/migrate-bible.ts --apply   # перенести
import "@/scripts/lib/env";
import { AnyBulkWriteOperation, Db, Document, ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { canonBook } from "@/utils/bibleCanon";
import { canonSort, formatCanonRef } from "@/lib/bible/refs";
import { mappingsFor, toCanonRef } from "@/lib/bible/mappings";
import { BIBLE_BOOKS, BIBLE_EDITIONS, BIBLE_VERSES } from "@/lib/bible/schema";

const APPLY = process.argv.includes("--apply");
const BATCH = 2000;

/** Издания, какие есть в базе сегодня. Ключ поиска старого документа — bibleLanguageCode. */
const EDITIONS = [
    {
        code: "cs-eliz",
        legacyLang: "cs",
        langCode: "cs",
        language: "cu",
        isDefaultForLang: true,
        title: "Библия (церковнославянский, Елизаветинская)",
        shortTitle: "ЦС",
        versification: "sla-lxx",
        year: 1751,
        sourceLink: "https://bible.by/elzs/",
        order: 1,
        public: true,
    },
    {
        code: "ro-1688",
        legacyLang: "ro",
        langCode: "ro",
        language: "ro_cyr",
        isDefaultForLang: true,
        title: "Сфънта Скриптура (Библия на румынской кириллице, 1688)",
        shortTitle: "РУМ",
        versification: "ro-1688",
        year: 1688,
        sourceLink:
            "https://www.academia.edu/43284538/БИ_БЛЇѦ_СА_Ꙋ_СФН_ТА_СК_РИП_ТꙊ_РЪ_Biblia_sau_Sfânta_Scriptură",
        order: 2,
        public: true,
    },
];

interface Warning {
    edition: string;
    message: string;
}

const warnings: Warning[] = [];
const warn = (edition: string, message: string) => warnings.push({ edition, message });

const migrateEdition = async (db: Db, spec: typeof EDITIONS[number]) => {
    const legacyBook = await db.collection("books").findOne({ bibleLanguageCode: spec.legacyLang });
    if (!legacyBook) {
        warn(spec.code, `издания с bibleLanguageCode=${spec.legacyLang} в базе нет — пропущено`);
        return null;
    }

    // Идентификатор издания берём у уже существующего (если прогон повторный),
    // иначе заводим новый: код издания — ключ, а не _id, чтобы код можно было
    // при нужде переименовать, не переписывая ссылки у 37 тысяч стихов.
    const existing = await db.collection(BIBLE_EDITIONS).findOne({ code: spec.code });
    const editionId = existing?._id ?? new ObjectId();

    const mapping = mappingsFor(spec.code);

    const legacyTexts = await db.collection("texts")
        .find({ bookId: legacyBook._id })
        .sort({ bookIndex: 1 })
        .toArray();

    const bookOps: AnyBulkWriteOperation<Document>[] = [];
    const verseOps: AnyBulkWriteOperation<Document>[] = [];
    let verseCount = 0;
    let remapped = 0;
    const now = new Date();

    for (const text of legacyTexts) {
        const slug: string = text.bibleBookSlug || "";
        if (!slug) {
            warn(spec.code, `у книги «${text.name}» (${text.alias || text._id}) нет bibleBookSlug — пропущена`);
            continue;
        }

        // Книга издания попадает в канон либо напрямую (слуг совпал), либо через
        // правило (Сусанна — это Дан. 13). Не опознанная ни так, ни так — сигнал,
        // что данные разъехались с каноном, и молчать об этом нельзя.
        const viaRule = toCanonRef(mapping, slug, 1, 1);
        const canonId = canonBook(slug) ? slug : viaRule.canonId;
        if (!canonBook(canonId)) {
            warn(spec.code, `книга «${text.name}» (слуг «${slug}») не опознана в каноне — пропущена`);
            continue;
        }

        bookOps.push({
            replaceOne: {
                filter: { _id: text._id },
                replacement: {
                    _id: text._id,
                    editionId,
                    slug,
                    canonId,
                    name: text.name || "",
                    alias: text.alias || "",
                    order: text.bookIndex ?? 0,
                    updatedAt: now,
                },
                upsert: true,
            },
        });

        const legacyVerses = await db.collection("verses").find({ textId: text._id }).toArray();

        for (const verse of legacyVerses) {
            const ref = toCanonRef(mapping, slug, verse.chapter, verse.verse);
            if (ref.canonId !== slug || ref.chapter !== verse.chapter || ref.verse !== verse.verse) {
                remapped++;
            }

            verseOps.push({
                replaceOne: {
                    filter: { _id: verse._id },
                    replacement: {
                        _id: verse._id,
                        editionId,
                        bookId: text._id,
                        canonId: ref.canonId,
                        chapter: verse.chapter,
                        verse: verse.verse,
                        canonChapter: ref.chapter,
                        canonVerse: ref.verse,
                        canonRef: formatCanonRef(ref.canonId, ref.chapter, ref.verse),
                        canonSort: canonSort(ref.chapter, ref.verse),
                        content: verse.content ?? "",
                        updatedAt: verse.updatedAt ?? now,
                    },
                    upsert: true,
                },
            });
            verseCount++;
        }
    }

    console.log(
        `${spec.code}: книг — ${bookOps.length} из ${legacyTexts.length}, стихов — ${verseCount}, ` +
        `перенумеровано правилами — ${remapped}`,
    );

    if (!APPLY) return { editionId, books: bookOps.length, verses: verseCount };

    await db.collection(BIBLE_EDITIONS).replaceOne(
        { code: spec.code },
        {
            _id: editionId,
            code: spec.code,
            langCode: spec.langCode,
            language: spec.language,
            isDefaultForLang: spec.isDefaultForLang,
            title: spec.title,
            shortTitle: spec.shortTitle,
            versification: spec.versification,
            year: spec.year,
            sourceLink: spec.sourceLink,
            bookId: legacyBook._id,
            mapping,
            order: spec.order,
            public: spec.public,
            updatedAt: now,
        },
        { upsert: true },
    );

    if (bookOps.length) await db.collection(BIBLE_BOOKS).bulkWrite(bookOps, { ordered: false });

    // Пишем частями: один bulkWrite на 37 тысяч замен упирается в предел размера
    // запроса Mongo, и упирается он не сразу, а на середине переноса.
    for (let i = 0; i < verseOps.length; i += BATCH) {
        await db.collection(BIBLE_VERSES).bulkWrite(verseOps.slice(i, i + BATCH), { ordered: false });
        process.stdout.write(`\r  записано стихов: ${Math.min(i + BATCH, verseOps.length)}/${verseOps.length}`);
    }
    if (verseOps.length) process.stdout.write("\n");

    return { editionId, books: bookOps.length, verses: verseCount };
};

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");

    if (!APPLY) console.log("ПЛАН (без --apply в базу ничего не пишется)\n");

    for (const spec of EDITIONS) {
        await migrateEdition(db, spec);
    }

    if (warnings.length) {
        console.log(`\nПредупреждений: ${warnings.length}`);
        warnings.forEach((w) => console.log(`  [${w.edition}] ${w.message}`));
    }

    if (APPLY) {
        const [editions, books, verses] = await Promise.all([
            db.collection(BIBLE_EDITIONS).countDocuments(),
            db.collection(BIBLE_BOOKS).countDocuments(),
            db.collection(BIBLE_VERSES).countDocuments(),
        ]);
        console.log(`\nВ базе: изданий — ${editions}, книг — ${books}, стихов — ${verses}`);
        console.log("Старые books/texts/verses не тронуты.");
    }
};

main().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
});
