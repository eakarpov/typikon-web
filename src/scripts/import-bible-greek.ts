// Импорт греческой Библии — Септуагинты и Патриаршего текста 1904 года — в
// коллекции bible_editions / bible_books / bible_verses.
//
// Данные приходят одним файлом greek/output/greek-bible.json, который собирает
// scripts/export_greek_bible.py в typikon-rules: там она выкачана (Ветхий Завет —
// издание Свита, Кембридж 1909–1930; Новый — myriobiblos.gr, библиотека Элладской
// Церкви) и разобрана. Здесь только укладка в базу и приведение к канону.
//
// ОДНО ИЗДАНИЕ НА ДВА ЗАВЕТА. Греческая православная Библия так и печатается —
// Ο΄ в Ветхом Завете, Патриарший текст в Новом. Завести их двумя изданиями было
// бы вернее источникам и хуже для чтений: `editionForLang` отдаёт на язык ОДНО
// издание, и у недефолтного половина Библии стала бы невидимой для устава.
//
// ЛИШНЕЕ УБИРАЕТСЯ. Перезапись по устойчивому _id делает импорт повторяемым
// только наполовину: изменившийся стих перепишется, а ИСЧЕЗНУВШИЙ останется в
// базе навсегда. Это не умозрительный случай — разбор перестал заводить 686
// стихов, которых издание не печатает, и без уборки они пережили бы правку.
// Поэтому после записи всё, что принадлежит этому изданию и не пришло в файле,
// удаляется. Чужие издания не трогаются: фильтр по editionId.
//
// ИДЕНТИФИКАТОРЫ ДЕТЕРМИНИРОВАННЫЕ. Здесь нечего сохранять — издание новое, на
// него ещё никто не ссылается, — но _id всё равно выводится хешем от кода
// издания, слуга книги и ссылки стиха. Тогда повторный прогон переписывает те же
// документы, а не заводит вторые: правила приведения будут дополняться, и каждое
// дополнение — это перезапуск.
//
// КНИГИ ВНЕ СЛАВЯНСКОГО КАНОНА ИМПОРТИРУЮТСЯ ТОЖЕ — со своими адресами.
// Свит печатает Оды, Псалмы Соломона, 4 Маккавейскую, Еноха, второй извод
// Товита и Даниила с Сусанной и Вилом ещё и в переводе LXX. Канон для них места
// не держит и держать не должен: по его идентификаторам резолвятся зачала.
// Поэтому у них свой реестр (@/utils/bibleAppendix), а лукап здесь идёт через
// bibleBook — «книга канона ИЛИ приложения». Их canonId не встречается ни в
// одном другом издании, поэтому в параллельном виде колонка рядом пуста; это
// правда, а не сбой: Еноха у славянской Библии нет.
//
// Запуск:
//   npx tsx src/scripts/import-bible-greek.ts           # план, в базу не пишет
//   npx tsx src/scripts/import-bible-greek.ts --apply   # импортировать
import "@/scripts/lib/env";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { AnyBulkWriteOperation, Document, ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { bibleBook } from "@/utils/bibleBooks";
import { canonSort, formatCanonRef } from "@/lib/bible/refs";
import { mappingsFor, toCanonRef } from "@/lib/bible/mappings";
import { BIBLE_BOOKS, BIBLE_EDITIONS, BIBLE_VERSES } from "@/lib/bible/schema";

const APPLY = process.argv.includes("--apply");
const BATCH = 2000;
const FILE_PATH = path.join(process.cwd(), "greek/output/greek-bible.json");

interface SourceBook {
    slug: string;
    canonId: string | null;
    name: string;
    greekName: string;
    testament: "ot" | "nt";
    /** Книга приложения: славянский канон её не держит. */
    outsideCanon: boolean;
    order: number;
    edition: string;
    sourceUrl: string;
    chapters: Record<string, Record<string, string>>;
}

interface SourceFile {
    code: string;
    title: string;
    shortTitle: string;
    langCode: string;
    language: string;
    versification: string;
    books: SourceBook[];
}

/** Устойчивый _id из строки: тот же вход — тот же документ при перезапуске. */
const oid = (seed: string) =>
    new ObjectId(crypto.createHash("md5").update(seed).digest("hex").slice(0, 24));

const main = async () => {
    if (!fs.existsSync(FILE_PATH)) {
        console.error(`Нет файла ${FILE_PATH} — сначала scripts/export_greek_bible.py в typikon-rules`);
        process.exit(1);
    }

    const source: SourceFile = JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
    const mapping = mappingsFor(source.code);
    const now = new Date();
    const editionId = oid(`edition:${source.code}`);

    const bookOps: AnyBulkWriteOperation<Document>[] = [];
    const verseOps: AnyBulkWriteOperation<Document>[] = [];
    const appendix: string[] = [];
    const warnings: string[] = [];
    let verseCount = 0;
    let remapped = 0;

    for (const book of source.books) {
        // Книга издания попадает на своё место либо напрямую, либо правилом
        // (Сусанна — это Дан. 13). Не опознанная ни так, ни так значит, что
        // разбор и канон разъехались, и молчать об этом нельзя.
        const viaRule = toCanonRef(mapping, book.slug, 1, 1);
        const canonId = bibleBook(book.canonId) ? book.canonId : viaRule.canonId;
        if (!bibleBook(canonId)) {
            warnings.push(`книга «${book.name}» (слуг «${book.slug}») не опознана ни в каноне, ` +
                          "ни в приложении — пропущена");
            continue;
        }
        if (book.outsideCanon) appendix.push(`${book.slug} (${book.name})`);

        const bookId = oid(`book:${source.code}:${book.slug}`);
        bookOps.push({
            replaceOne: {
                filter: { _id: bookId },
                replacement: {
                    _id: bookId,
                    editionId,
                    slug: book.slug,
                    canonId,
                    name: book.name,
                    // Прежнего адреса чтения у греческой Библии нет — она никогда не
                    // лежала в `texts`, поэтому и редиректу неоткуда вести.
                    alias: "",
                    order: book.order,
                    updatedAt: now,
                },
                upsert: true,
            },
        });

        for (const [chapterKey, verses] of Object.entries(book.chapters)) {
            const chapter = Number(chapterKey);
            for (const [verseKey, content] of Object.entries(verses)) {
                const verse = Number(verseKey);
                const ref = toCanonRef(mapping, book.slug, chapter, verse);
                if (ref.canonId !== book.slug || ref.chapter !== chapter || ref.verse !== verse) {
                    remapped++;
                }

                const verseId = oid(`verse:${source.code}:${book.slug}:${chapter}:${verse}`);
                verseOps.push({
                    replaceOne: {
                        filter: { _id: verseId },
                        replacement: {
                            _id: verseId,
                            editionId,
                            bookId,
                            canonId: ref.canonId,
                            chapter,
                            verse,
                            canonChapter: ref.chapter,
                            canonVerse: ref.verse,
                            canonRef: formatCanonRef(ref.canonId, ref.chapter, ref.verse),
                            canonSort: canonSort(ref.chapter, ref.verse),
                            content,
                            updatedAt: now,
                        },
                        upsert: true,
                    },
                });
                verseCount++;
            }
        }
    }

    console.log(`${source.code}: книг — ${bookOps.length}, стихов — ${verseCount}, ` +
                `перенумеровано правилами — ${remapped}`);
    if (appendix.length) {
        console.log(`\nиз них вне славянского канона, со своими адресами (${appendix.length}):`);
        appendix.forEach((s) => console.log(`   ${s}`));
    }
    if (warnings.length) {
        console.log(`\nПредупреждений: ${warnings.length}`);
        warnings.forEach((w) => console.log(`   ${w}`));
    }

    if (!APPLY) {
        console.log("\nПЛАН: без --apply в базу ничего не записано");
        process.exit(0);
    }

    const db = (await clientPromise).db("typikon");

    await db.collection(BIBLE_EDITIONS).replaceOne(
        { code: source.code },
        {
            _id: editionId,
            code: source.code,
            langCode: source.langCode,
            language: source.language,
            isDefaultForLang: true,
            title: source.title,
            shortTitle: source.shortTitle,
            versification: source.versification,
            // Год издания у составного издания один назвать нельзя: Ветхий Завет
            // Свитов (1909–1930), Новый — Патриарший (1904). Пусть будет пусто,
            // а годы стоят в подписи, чем одно из двух выдавать за оба.
            year: null,
            sourceLink: "https://www.myriobiblos.gr/bible/nt2/",
            bookId: null,
            mapping,
            order: 3,
            public: true,
            updatedAt: now,
        },
        { upsert: true },
    );

    if (bookOps.length) await db.collection(BIBLE_BOOKS).bulkWrite(bookOps, { ordered: false });

    // Частями: один bulkWrite на 38 тысяч замен упирается в предел размера
    // запроса Mongo, и упирается не сразу, а на середине.
    for (let i = 0; i < verseOps.length; i += BATCH) {
        await db.collection(BIBLE_VERSES).bulkWrite(verseOps.slice(i, i + BATCH), { ordered: false });
        process.stdout.write(`\r  записано стихов: ${Math.min(i + BATCH, verseOps.length)}/${verseOps.length}`);
    }
    if (verseOps.length) process.stdout.write("\n");

    // Уборка: всё, что осталось от прошлых прогонов и в этом не пришло.
    const keptBooks = bookOps.map((op) => (op as any).replaceOne.replacement._id);
    const keptVerses = verseOps.map((op) => (op as any).replaceOne.replacement._id);
    const goneBooks = await db.collection(BIBLE_BOOKS)
        .deleteMany({ editionId, _id: { $nin: keptBooks } });
    const goneVerses = await db.collection(BIBLE_VERSES)
        .deleteMany({ editionId, _id: { $nin: keptVerses } });
    if (goneBooks.deletedCount || goneVerses.deletedCount) {
        console.log(`убрано лишнего от прошлых прогонов: книг ${goneBooks.deletedCount}, ` +
                    `стихов ${goneVerses.deletedCount}`);
    }

    console.log("Готово.");
    process.exit(0);
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
