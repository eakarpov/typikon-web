// Замена греческого Нового Завета на текст в общественном достоянии.
//
// ЗАЧЕМ. Наша копия Патриаршего издания 1904/1912 была взята у библиотеки
// Элладской Церкви (myriobiblos.gr), где условий распространения не заявлено, —
// то есть распространять её мы не вправе, и в выгрузку корпуса она не шла.
// eBible.org отдаёт то же издание («1904 Patriarchal Greek New Testament with 20
// corrections from later editions») как ОБЩЕСТВЕННОЕ ДОСТОЯНИЕ, с ударениями,
// полным USFM и номерами Стронга, ровно теми же 7 958 стихами.
//
// И он оказался ВЕРНЕЕ. Сверка обоих текстов с выверенным по печатному изданию
// текстом М. Робинсона (byztxt/greektext-antoniades — он без ударений, но
// эталон состава слов), со снятым у всех троих подвижным «ν»:
//
//     наш (myriobiblos)   89,1 % совпадения с печатным изданием
//     eBible grcbyz       96,1 %
//
// То есть переход — не уступка ради лицензии, а исправление: около 556 стихов,
// где печатному изданию отвечает он, а не мы.
//
// ЧТО МЕНЯЕТСЯ. Около 1 480 стихов: 660 по составу слов (γένεσις/γέννησις в
// Мф. 1:18, οὕτω/οὕτως в Мф. 2:5), остальные по ударению. Плюс появляется
// Рим. 14:26 — византийское славословие, которое издание печатает в конце
// четырнадцатой главы, а у нас его не было вовсе.
//
// ВЕТХИЙ ЗАВЕТ НЕ ТРОГАЕТСЯ. Он в этом же издании (греческая православная
// Библия — это Ο΄ в Ветхом и Патриарший текст в Новом, одним изданием), но взят
// из другого источника и под другой лицензией. Уборка исчезнувших стихов
// ограничена книгами Нового Завета: фильтр по их bookId, а не по изданию.
//
// Идентификаторы выводятся тем же хешем, что в import-bible-edition.ts, — иначе
// стихи раздвоились бы: старый документ остался бы рядом с новым.
//
// Источник: ebible.org/find/details.php?id=grcbyz -> grcbyz_usfm.zip,
// распакован в greek/grcbyz (каталог greek/ в .gitignore).
//
// Запуск:
//   npm run bible:greek-nt                  # показать, что изменится
//   npm run bible:greek-nt -- --apply       # заменить
import "@/scripts/lib/env";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { AnyBulkWriteOperation, Document, ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { canonSort, formatCanonRef } from "@/lib/bible/refs";
import { BIBLE_BOOKS, BIBLE_EDITIONS, BIBLE_VERSES } from "@/lib/bible/schema";

const APPLY = process.argv.includes("--apply");
const EDITION = "grc-lxx-pat";
const givenDir = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const DIR = givenDir || "greek/grcbyz";

/** Коды книг USFM -> слуги наших книг издания (у Нового Завета совпадают с каноном). */
const BOOKS: Record<string, string> = {
    MAT: "matfeya", MRK: "marka", LUK: "luki", JHN: "ioanna", ACT: "deyaniya",
    JAS: "iakova", "1PE": "1-petra", "2PE": "2-petra",
    "1JN": "1-ioanna-posl", "2JN": "2-ioanna-posl", "3JN": "3-ioanna-posl", JUD: "iudy",
    ROM: "rimlyanam", "1CO": "1-korinfyanam", "2CO": "2-korinfyanam", GAL: "galatam",
    EPH: "efesyanam", PHP: "filippiytsam", COL: "kolossyanam",
    "1TH": "1-fessaloniyitsam", "2TH": "2-fessaloniyitsam",
    "1TI": "1-timofeyu", "2TI": "2-timofeyu", TIT: "titu", PHM: "filimonu",
    HEB: "evreyam", REV: "otkrovenie",
};

const oid = (seed: string) =>
    new ObjectId(crypto.createHash("md5").update(seed).digest("hex").slice(0, 24));

/**
 * Текст стиха из разметки USFM. Метка слова может переходить через перенос
 * строки, поэтому чистится СОБРАННЫЙ стих, а не отдельная строка: построчная
 * чистка оставляла номера Стронга прямо в тексте.
 */
const plain = (raw: string) => raw
    .replace(/\\\+?w\s+([^|\\]*?)(\|[^\\]*?)?\\\+?w\*/g, "$1")
    .replace(/\|strong="[^"]*"/g, "")
    .replace(/\\[a-z0-9]+\*?/gi, " ")
    .replace(/\s+([,.;·:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

interface Parsed { book: string; chapter: number; verse: number; content: string }

const readUsfm = (dir: string): Parsed[] => {
    const out: Parsed[] = [];

    for (const file of fs.readdirSync(dir).sort()) {
        const code = file.match(/-(\w{3})grcbyz\.usfm$/)?.[1];
        const slug = code && BOOKS[code];
        if (!slug) continue;

        const lines = fs.readFileSync(path.join(dir, file), "utf-8").split("\n");
        let chapter = 0;
        let verse: number | null = null;
        let buffer = "";

        const flush = () => {
            if (verse !== null) out.push({ book: slug, chapter, verse, content: plain(buffer) });
            verse = null;
            buffer = "";
        };

        for (const line of lines) {
            const chapterMatch = line.match(/^\\c\s+(\d+)/);
            if (chapterMatch) { flush(); chapter = Number(chapterMatch[1]); continue; }

            const verseMatch = line.match(/^\\v\s+(\d+)\s*(.*)$/);
            if (verseMatch) { flush(); verse = Number(verseMatch[1]); buffer = verseMatch[2]; continue; }

            // Заголовки книги к стиху не относятся; всё прочее — продолжение.
            if (verse !== null && !/^\\(id|h|toc|mt|ide|rem)/.test(line)) buffer += ` ${line}`;
        }
        flush();
    }

    return out;
};

const main = async () => {
    if (!fs.existsSync(DIR)) {
        console.error(`Нет каталога ${DIR}. Возьми grcbyz_usfm.zip с ebible.org и распакуй туда:`);
        console.error("  https://ebible.org/find/details.php?id=grcbyz");
        process.exit(1);
    }

    const parsed = readUsfm(DIR);
    if (!parsed.length) {
        console.error(`В ${DIR} не нашлось ни одного стиха — не тот каталог?`);
        process.exit(1);
    }

    const client = await clientPromise;
    const db = client.db("typikon");
    const edition = await db.collection(BIBLE_EDITIONS).findOne({ code: EDITION });
    if (!edition) {
        console.error(`Издания ${EDITION} нет в базе`);
        process.exit(1);
    }

    const books = await db.collection(BIBLE_BOOKS)
        .find({ editionId: edition._id, slug: { $in: Object.values(BOOKS) } }).toArray();
    const bookBySlug = new Map(books.map((book) => [book.slug as string, book]));

    const missing = [...new Set(parsed.map((p) => p.book))].filter((slug) => !bookBySlug.has(slug));
    if (missing.length) {
        console.error(`Этих книг нет в издании: ${missing.join(", ")}`);
        process.exit(1);
    }

    const existing = await db.collection(BIBLE_VERSES)
        .find({ editionId: edition._id, bookId: { $in: books.map((b) => b._id) } }).toArray();
    const before = new Map(existing.map((v) => [String(v._id), v]));

    const now = new Date();
    const ops: AnyBulkWriteOperation<Document>[] = [];
    const keep = new Set<string>();
    let added = 0;
    let changed = 0;
    let same = 0;

    for (const item of parsed) {
        const book = bookBySlug.get(item.book)!;
        const id = oid(`verse:${EDITION}:${item.book}:${item.chapter}:${item.verse}`);
        keep.add(String(id));

        const was = before.get(String(id));
        if (!was) added++;
        else if (was.content !== item.content) changed++;
        else same++;

        ops.push({
            replaceOne: {
                filter: { _id: id },
                replacement: {
                    _id: id,
                    editionId: edition._id,
                    bookId: book._id,
                    // У Нового Завета правил приведения нет: родная нумерация и
                    // каноническая совпадают, книга издания — книга канона.
                    canonId: book.canonId,
                    chapter: item.chapter,
                    verse: item.verse,
                    canonChapter: item.chapter,
                    canonVerse: item.verse,
                    canonRef: formatCanonRef(book.canonId, item.chapter, item.verse),
                    canonSort: canonSort(item.chapter, item.verse),
                    content: item.content,
                    updatedAt: now,
                },
                upsert: true,
            },
        });
    }

    const gone = existing.filter((v) => !keep.has(String(v._id)));

    console.log(`${DIR}: книг ${new Set(parsed.map((p) => p.book)).size}, стихов ${parsed.length}`);
    console.log(`  без изменений: ${same}`);
    console.log(`  переписано:    ${changed}`);
    console.log(`  добавлено:     ${added}`);
    console.log(`  удаляется:     ${gone.length}`);
    gone.slice(0, 10).forEach((v) => console.log(`     ${v.canonRef}`));

    if (!APPLY) {
        console.log("\nПЛАН: без --apply в базу ничего не записано");
        await client.close();
        return;
    }

    for (let i = 0; i < ops.length; i += 2000) {
        await db.collection(BIBLE_VERSES).bulkWrite(ops.slice(i, i + 2000), { ordered: false });
    }
    if (gone.length) {
        await db.collection(BIBLE_VERSES).deleteMany({ _id: { $in: gone.map((v) => v._id) } });
    }

    // Происхождение — часть данных, а не примечание: издание теперь ссылается
    // туда, откуда взят текст, иначе следующий разбор пойдёт по прежнему адресу.
    await db.collection(BIBLE_EDITIONS).updateOne(
        { _id: edition._id },
        { $set: { sourceLink: "https://ebible.org/find/details.php?id=grcbyz", updatedAt: now } },
    );

    console.log("\nЗаписано. Не забудь сбросить кэш выборок: POST /api/revalidate");

    // Соединение закрываем явно: клиент общий и держит пул открытым, поэтому
    // без этого скрипт отрабатывает и не завершается.
    await client.close();
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
