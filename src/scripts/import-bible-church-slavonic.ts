// Импорт Елизаветинской Библии (церковнославянский, ред. 1751/1900) с bible.by/elzs/
// в коллекции books/texts/verses, по аналогии с уже импортированной румынской
// Библией (см. import-bible-cyrillic.ts). Создаёт новый сборник "Библия
// (церковнославянский, Елизаветинская)" со всеми 77 книгами.
//
// Источник — чистая построчная HTML-разметка по стихам (не OCR), лицензия —
// public domain (см. страницу сайта). robots.txt разрешает обход /elzs/.
//
// Запуск: npx tsx src/scripts/import-bible-church-slavonic.ts
//   Можно ограничить прогон одной книгой для проверки: --book=bytie
import "@/scripts/lib/env";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { TextKind } from "@/utils/texts";

const SOURCE_BASE = "https://bible.by/elzs";
const USER_AGENT = "Mozilla/5.0 (compatible; typikon.su-importer/1.0; +https://typikon.su)";
const REQUEST_DELAY_MS = 350;

// Каноничный порядок книг Елизаветинской Библии (славянская традиция: соборные
// послания перед посланиями ап. Павла, неканонические книги на своих местах в ВЗ).
// bibleById — числовой id книги на bible.by/elzs/{id}/{chapter}/.
const CANONICAL_BOOKS: Array<{ bibleById: number; name: string; slug: string }> = [
    { bibleById: 1, name: "Бытие", slug: "bytie" },
    { bibleById: 2, name: "Исход", slug: "iskhod" },
    { bibleById: 3, name: "Левит", slug: "levit" },
    { bibleById: 4, name: "Числа", slug: "chisla" },
    { bibleById: 5, name: "Второзаконие", slug: "vtorozakonie" },
    { bibleById: 6, name: "Книга Иисуса Навина", slug: "iisus-navin" },
    { bibleById: 7, name: "Книга Судей", slug: "sudi" },
    { bibleById: 8, name: "Руфь", slug: "ruf" },
    { bibleById: 9, name: "1-я Царств", slug: "1-tsarstv" },
    { bibleById: 10, name: "2-я Царств", slug: "2-tsarstv" },
    { bibleById: 11, name: "3-я Царств", slug: "3-tsarstv" },
    { bibleById: 12, name: "4-я Царств", slug: "4-tsarstv" },
    { bibleById: 13, name: "1-я Паралипоменон", slug: "1-paralipomenon" },
    { bibleById: 14, name: "2-я Паралипоменон", slug: "2-paralipomenon" },
    { bibleById: 15, name: "1-я Ездры", slug: "1-ezdry" },
    { bibleById: 16, name: "Неемии", slug: "neemii" },
    { bibleById: 77, name: "Товита", slug: "tovita" },
    { bibleById: 73, name: "Иудифи", slug: "iudifi" },
    { bibleById: 17, name: "Есфирь", slug: "esfir" },
    { bibleById: 18, name: "Иова", slug: "iova" },
    { bibleById: 19, name: "Псалтирь", slug: "psaltir" },
    { bibleById: 20, name: "Притчи Соломона", slug: "pritchi" },
    { bibleById: 21, name: "Екклесиаст", slug: "ekklesiast" },
    { bibleById: 22, name: "Песнь Песней", slug: "pesn-pesney" },
    { bibleById: 75, name: "Премудрости Соломона", slug: "premudrosti-solomona" },
    { bibleById: 76, name: "Премудрости Иисуса, сына Сирахова", slug: "sirakha" },
    { bibleById: 23, name: "Исаии", slug: "isaii" },
    { bibleById: 24, name: "Иеремии", slug: "ieremii" },
    { bibleById: 25, name: "Плач Иеремии", slug: "plach-ieremii" },
    { bibleById: 74, name: "Послание Иеремии", slug: "poslanie-ieremii" },
    { bibleById: 70, name: "Варуха", slug: "varukha" },
    { bibleById: 26, name: "Иезекииля", slug: "iezekiilya" },
    { bibleById: 27, name: "Даниила", slug: "daniila" },
    { bibleById: 28, name: "Осии", slug: "osii" },
    { bibleById: 29, name: "Иоиля", slug: "ioilya" },
    { bibleById: 30, name: "Амоса", slug: "amosa" },
    { bibleById: 31, name: "Авдия", slug: "avdiya" },
    { bibleById: 32, name: "Ионы", slug: "iony" },
    { bibleById: 33, name: "Михея", slug: "mikheya" },
    { bibleById: 34, name: "Наума", slug: "nauma" },
    { bibleById: 35, name: "Аввакума", slug: "avvakuma" },
    { bibleById: 36, name: "Софонии", slug: "sofonii" },
    { bibleById: 37, name: "Аггея", slug: "aggeya" },
    { bibleById: 38, name: "Захарии", slug: "zakharii" },
    { bibleById: 39, name: "Малахии", slug: "malakhii" },
    { bibleById: 67, name: "1-я Маккавейская", slug: "1-makkaveyskaya" },
    { bibleById: 68, name: "2-я Маккавейская", slug: "2-makkaveyskaya" },
    { bibleById: 69, name: "3-я Маккавейская", slug: "3-makkaveyskaya" },
    { bibleById: 71, name: "2-я Ездры", slug: "2-ezdry" },
    { bibleById: 72, name: "3-я Ездры", slug: "3-ezdry" },
    { bibleById: 40, name: "От Матфея", slug: "matfeya" },
    { bibleById: 41, name: "От Марка", slug: "marka" },
    { bibleById: 42, name: "От Луки", slug: "luki" },
    { bibleById: 43, name: "От Иоанна", slug: "ioanna" },
    { bibleById: 44, name: "Деяния апостолов", slug: "deyaniya" },
    { bibleById: 45, name: "Иакова", slug: "iakova" },
    { bibleById: 46, name: "1-е Петра", slug: "1-petra" },
    { bibleById: 47, name: "2-е Петра", slug: "2-petra" },
    { bibleById: 48, name: "1-е Иоанна", slug: "1-ioanna-posl" },
    { bibleById: 49, name: "2-е Иоанна", slug: "2-ioanna-posl" },
    { bibleById: 50, name: "3-е Иоанна", slug: "3-ioanna-posl" },
    { bibleById: 51, name: "Иуды", slug: "iudy" },
    { bibleById: 52, name: "К Римлянам", slug: "rimlyanam" },
    { bibleById: 53, name: "1-е Коринфянам", slug: "1-korinfyanam" },
    { bibleById: 54, name: "2-е Коринфянам", slug: "2-korinfyanam" },
    { bibleById: 55, name: "К Галатам", slug: "galatam" },
    { bibleById: 56, name: "К Ефесянам", slug: "efesyanam" },
    { bibleById: 57, name: "К Филиппийцам", slug: "filippiytsam" },
    { bibleById: 58, name: "К Колоссянам", slug: "kolossyanam" },
    { bibleById: 59, name: "1-е Фессалоникийцам", slug: "1-fessaloniyitsam" },
    { bibleById: 60, name: "2-е Фессалоникийцам", slug: "2-fessaloniyitsam" },
    { bibleById: 61, name: "1-е Тимофею", slug: "1-timofeyu" },
    { bibleById: 62, name: "2-е Тимофею", slug: "2-timofeyu" },
    { bibleById: 63, name: "К Титу", slug: "titu" },
    { bibleById: 64, name: "К Филимону", slug: "filimonu" },
    { bibleById: 65, name: "К Евреям", slug: "evreyam" },
    { bibleById: 66, name: "Откровение", slug: "otkrovenie" },
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const fetchHtml = async (url: string, attempt = 1): Promise<string> => {
    try {
        const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return await res.text();
    } catch (e) {
        if (attempt >= 3) throw e;
        await sleep(1000 * attempt);
        return fetchHtml(url, attempt + 1);
    }
};

const decodeEntities = (s: string): string =>
    s
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'");

// Внутри стиха встречается только один вид разметки — вставки переводчиков
// (обычно надписания псалмов): <span class="add" ...><font>...</font></span>.
// Остальное — чистый текст.
const cleanVerseHtml = (html: string): string =>
    decodeEntities(
        html
            .replace(/<span class="add"[^>]*><font>/g, "")
            .replace(/<\/font><\/span>/g, "")
            .replace(/<[^>]+>/g, "")
    ).trim();

const getChapterCount = async (bibleById: number): Promise<number> => {
    const html = await fetchHtml(`${SOURCE_BASE}/${bibleById}/1/`);
    const modalMatch = html.match(/id="bchapter"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/);
    const scope = modalMatch ? modalMatch[0] : html;
    const chapterLinks = [...scope.matchAll(new RegExp(`/elzs/${bibleById}/(\\d+)/`, "g"))]
        .map(m => parseInt(m[1], 10));
    const max = Math.max(1, ...chapterLinks);
    return max;
};

const getChapterVerses = async (bibleById: number, chapter: number): Promise<Array<{ verse: number; content: string }>> => {
    const html = await fetchHtml(`${SOURCE_BASE}/${bibleById}/${chapter}/`);
    const containerMatch = html.match(/<div class="text elzs"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*\n*<script>/);
    if (!containerMatch) return [];
    const container = containerMatch[1];
    const verseMatches = [...container.matchAll(/<div id="(\d+)">\s*<sup>\d+<\/sup>\s*([\s\S]*?)<\/div>/g)];
    return verseMatches.map(m => ({
        verse: parseInt(m[1], 10),
        content: cleanVerseHtml(m[2]),
    })).filter(v => v.content.length > 0);
};


// ОТРАБОТАВШИЙ СКРИПТ. Он писал в прежнюю модель (books/texts/verses), которой
// больше нет: Библия живёт в bible_editions/bible_books/bible_verses
// (@/lib/bible/schema). Оставлен ради разбора источника — это единственное место,
// где записано, как из него добывались стихи, а корпус ещё придётся дочищать
// (в церковнославянском Исходе нет глав 37–39: в источнике они без стиховой
// разбивки). Прежде чем запускать снова, перепишите запись под новые коллекции.
//
// Пока этого не сделано, скрипт отказывается работать: молча залить корпус в
// мёртвые коллекции хуже, чем не залить вовсе.

const main = async () => {
    const onlySlug = process.argv.find(a => a.startsWith("--book="))?.split("=")[1];
    const books = onlySlug ? CANONICAL_BOOKS.filter(b => b.slug === onlySlug) : CANONICAL_BOOKS;
    if (onlySlug && books.length === 0) {
        throw new Error(`Книга со slug="${onlySlug}" не найдена в CANONICAL_BOOKS`);
    }

    const client = await clientPromise;
    const db = client.db("typikon");

    let collectionId: ObjectId;
    if (onlySlug) {
        // Тестовый прогон одной книги — не создаём новый сборник, используем заглушку.
        collectionId = new ObjectId();
        console.log("Тестовый режим (--book), сборник в базу не создаётся/не обновляется.");
    } else {
        const inserted = await db.collection("books").insertOne({
            name: "Библия (церковнославянский, Елизаветинская)",
            description: "Елизаветинская Библия (ред. 1751/1900) на церковнославянском языке",
            author: "",
            translator: "",
            order: 56,
            texts: [],
            public: false, // включим после проверки полноты импорта
            updatedAt: new Date(),
        });
        collectionId = inserted.insertedId;
        console.log(`Создан сборник books._id=${collectionId}`);
    }

    const SOURCE_LINK = "https://bible.by/elzs/";
    let bookIndex = 1;
    let totalVerses = 0;
    const insertedTextIds: ObjectId[] = [];

    for (const book of books) {
        const chapterCount = await getChapterCount(book.bibleById);
        await sleep(REQUEST_DELAY_MS);

        const rows: Array<{ chapter: number; verse: number; content: string }> = [];
        for (let ch = 1; ch <= chapterCount; ch++) {
            const verses = await getChapterVerses(book.bibleById, ch);
            verses.forEach(v => rows.push({ chapter: ch, verse: v.verse, content: v.content }));
            await sleep(REQUEST_DELAY_MS);
        }

        if (rows.length === 0) {
            console.warn(`!! ${book.name} — не удалось получить ни одного стиха, пропускаю`);
            continue;
        }

        const textId = new ObjectId();
        const alias = `biblia-cs-${book.slug}-${bookIndex}`;

        if (!onlySlug) {
            await db.collection("texts").insertOne({
                _id: textId,
                name: book.name,
                content: "",
                description: `${book.name} на церковнославянском языке (Елизаветинская Библия)`,
                start: "",
                fileId: null,
                link: SOURCE_LINK,
                ruLink: "",
                bookId: collectionId,
                footnotes: [],
                createdAt: new Date(),
                adminInfo: "",
                alias,
                author: "",
                bookIndex,
                csSource: true,
                dneslovEventId: "",
                dneslovId: "",
                dneslovType: null,
                images: [""],
                info: "",
                initialPriestExclamation: null,
                mentionIds: [],
                newUi: false,
                poems: "",
                quotes: [],
                readiness: "ready",
                startPhrase: null,
                translator: "",
                type: TextKind.TEACHIND,
                updatedAt: new Date(),
                contentType: "verses",
                saintId: "",
                textingPriority: null,
            });

            await db.collection("verses").insertMany(
                rows.map(r => ({
                    textId,
                    chapter: r.chapter,
                    verse: r.verse,
                    content: r.content,
                    updatedAt: new Date(),
                }))
            );

            insertedTextIds.push(textId);
        }

        totalVerses += rows.length;
        console.log(`${bookIndex}. ${book.name} — ${chapterCount} гл., ${rows.length} стихов, alias=${alias}`);
        bookIndex++;
    }

    if (!onlySlug) {
        await db.collection("books").updateOne(
            { _id: collectionId },
            { $set: { texts: insertedTextIds, updatedAt: new Date() } }
        );
    }

    console.log(`\nГотово: книг — ${bookIndex - 1}, стихов всего — ${totalVerses}`);
};

if (!process.argv.includes("--i-rewrote-it")) {
    console.error(
        "Скрипт отработал и писал в прежнюю модель Библии (books/texts/verses), которой больше нет. " +
        "Перепишите запись под bible_editions/bible_books/bible_verses — см. шапку файла."
    );
    process.exit(1);
}

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
