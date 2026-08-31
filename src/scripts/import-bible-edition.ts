// Импорт ИЗДАНИЯ Библии в коллекции bible_editions / bible_books / bible_verses.
//
// Скрипт один на все издания, и это условие, а не удобство: правила приведения,
// уборка лишнего и устойчивые идентификаторы должны работать у всех одинаково,
// а копия на язык расходится с оригиналом на второй же правке.
//
// Данные приходят одним JSON, который собирает соседний проект typikon-rules
// (scripts/export_*.py): там издание выкачано и разобрано, здесь только укладка
// в базу и приведение к канону. Файл называет и само издание — код, заголовок,
// язык, год, ссылку на источник, — чтобы добавление следующего не требовало
// правки этого скрипта.
//
// ОДНО ИЗДАНИЕ НА ВСЮ БИБЛИЮ, даже когда заветы напечатаны с разных оригиналов:
// греческая православная Библия — это Ο΄ в Ветхом Завете и Патриарший текст в
// Новом. Завести их двумя изданиями было бы вернее источникам и хуже для
// чтений: `editionForLang` отдаёт на язык ОДНО издание, и у недефолтного
// половина Библии стала бы невидимой для устава.
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
//   npx tsx src/scripts/import-bible-edition.ts greek/output/greek-bible.json
//   npx tsx src/scripts/import-bible-edition.ts latin/output/vulgate.json --apply
//
// Без --apply в базу ничего не пишется.
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
import { bibleScopeTitle, DEFAULT_BIBLE_SCOPE } from "@/utils/bibleScope";
import { absentFromCanon, bibleEditionCanonTitle, DEFAULT_BIBLE_EDITION_CANON } from "@/utils/bibleEditionCanon";

const APPLY = process.argv.includes("--apply");
const BATCH = 2000;
const GIVEN = process.argv.slice(2).find((arg) => !arg.startsWith("--"));

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
    /** Год издания; null у составных, где одним годом не назвать. */
    year: number | null;
    sourceLink: string;
    /**
     * Объявленный объём (@/utils/bibleScope). Необязателен: до частичных
     * переводов все издания были полными Библиями, и пустое поле значит именно
     * это, а не «неизвестно».
     */
    scope?: string;
    /** Канон традиции (@/utils/bibleEditionCanon). Необъявленный — эталонный. */
    canon?: string;
    /** Место колонки в параллельном виде. */
    order: number;
    books: SourceBook[];
}

/** Устойчивый _id из строки: тот же вход — тот же документ при перезапуске. */
const oid = (seed: string) =>
    new ObjectId(crypto.createHash("md5").update(seed).digest("hex").slice(0, 24));

const main = async () => {
    if (!GIVEN) {
        console.error("Не сказано, что импортировать. Например:");
        console.error("  npx tsx src/scripts/import-bible-edition.ts latin/output/vulgate.json --apply");
        process.exit(1);
    }

    const filePath = path.isAbsolute(GIVEN) ? GIVEN : path.join(process.cwd(), GIVEN);
    if (!fs.existsSync(filePath)) {
        console.error(`Нет файла ${filePath} — сначала собери его scripts/export_*.py в typikon-rules`);
        process.exit(1);
    }

    const source: SourceFile = JSON.parse(fs.readFileSync(filePath, "utf-8"));
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

    // Объём говорим вслух: необъявленное считается полной Библией, и частичный
    // перевод, забывший объявиться, иначе молча прикинулся бы Библией с дырами.
    console.log(`объём издания: ${bibleScopeTitle(source.scope)}` +
                (source.scope ? "" : "  (в файле не объявлен — считаю полной Библией)"));
    const absent = absentFromCanon(source.canon);
    console.log(`канон: ${bibleEditionCanonTitle(source.canon)}` +
                (absent.length ? `  (нет: ${absent.join(", ")})` : "") +
                (source.canon ? "" : "  (в файле не объявлен — считаю эталонным)"));
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
            // Не объявлено — считаем полной Библией: так было со всеми четырьмя
            // изданиями до появления частичных переводов, и умолчание не должно
            // менять их смысла задним числом.
            scope: source.scope ?? DEFAULT_BIBLE_SCOPE,
            // Необъявленный канон — эталонный: так было со всеми изданиями до
            // того, как ось завели, и умолчание не должно снимать проверок.
            canon: source.canon ?? DEFAULT_BIBLE_EDITION_CANON,
            // Год приходит из файла и бывает пустым намеренно: у составного
            // издания одним годом не назвать (греческий Ветхий Завет Свитов
            // 1909–1930, Новый — Патриарший 1904), и лучше пусто, чем одно из
            // двух выдать за оба.
            year: source.year ?? null,
            sourceLink: source.sourceLink ?? "",
            bookId: null,
            mapping,
            order: source.order ?? 99,
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
