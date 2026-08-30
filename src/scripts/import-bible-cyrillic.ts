// Импорт оставшихся книг румынской Библии (валашская кириллица, 1688) из
// romanian/output/bible_cyrillic.txt в коллекции texts/verses, по аналогии с уже
// добавленной вручную книгой Бытие (/reading/biblia-rom-bytie-1).
//
// Запуск: npm run script -- import-bible-cyrillic
//   (или напрямую: npx tsx src/scripts/import-bible-cyrillic.ts)
import "@/scripts/lib/env";
import fs from "fs";
import path from "path";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { parseBulkVerseText } from "@/utils/verses";
import { TextKind } from "@/utils/texts";

const FILE_PATH = path.join(process.cwd(), "romanian/output/bible_cyrillic.txt");
const BOOK_ID = new ObjectId("6989959c169656dfeafaa36a"); // Сфънта Скриптура (Библия - на румынской кириллице)
const SOURCE_LINK =
    "https://www.academia.edu/43284538/БИ_БЛЇѦ_СА_Ꙋ_СФН_ТА_СК_РИП_ТꙊ_РЪ_Biblia_sau_Sfânta_Scriptură";

// Порядок соответствует порядку книг в файле (после Бытия, которое уже импортировано).
const RU_BOOKS: Array<{ name: string; slug: string }> = [
    { name: "Исход", slug: "iskhod" },
    { name: "Левит", slug: "levit" },
    { name: "Числа", slug: "chisla" },
    { name: "Второзаконие", slug: "vtorozakonie" },
    { name: "Книга Иисуса Навина", slug: "iisus-navin" },
    { name: "Книга Судей", slug: "sudi" },
    { name: "Руфь", slug: "ruf" },
    { name: "1-я Царств", slug: "1-tsarstv" },
    { name: "2-я Царств", slug: "2-tsarstv" },
    { name: "3-я Царств", slug: "3-tsarstv" },
    { name: "4-я Царств", slug: "4-tsarstv" },
    { name: "1-я Паралипоменон", slug: "1-paralipomenon" },
    { name: "2-я Паралипоменон", slug: "2-paralipomenon" },
    { name: "1-я Ездры", slug: "1-ezdry" },
    { name: "Неемии", slug: "neemii" },
    { name: "Есфирь", slug: "esfir" },
    { name: "Иова", slug: "iova" },
    { name: "Псалтирь", slug: "psaltir" },
    { name: "Притчи Соломона", slug: "pritchi" },
    { name: "Екклесиаст", slug: "ekklesiast" },
    { name: "Песнь Песней", slug: "pesn-pesney" },
    { name: "Исаии", slug: "isaii" },
    { name: "Иеремии", slug: "ieremii" },
    { name: "Плач Иеремии", slug: "plach-ieremii" },
    { name: "Иезекииля", slug: "iezekiilya" },
    { name: "Даниила", slug: "daniila" },
    { name: "Осии", slug: "osii" },
    { name: "Амоса", slug: "amosa" },
    { name: "Михея", slug: "mikheya" },
    { name: "Иоиля", slug: "ioilya" },
    { name: "Авдия", slug: "avdiya" },
    { name: "Ионы", slug: "iony" },
    { name: "Наума", slug: "nauma" },
    { name: "Аввакума", slug: "avvakuma" },
    { name: "Софонии", slug: "sofonii" },
    { name: "Аггея", slug: "aggeya" },
    { name: "Захарии", slug: "zakharii" },
    { name: "Малахии", slug: "malakhii" },
    { name: "Товита", slug: "tovita" },
    { name: "Иудифи", slug: "iudifi" },
    { name: "Варуха", slug: "varukha" },
    { name: "Послание Иеремии", slug: "poslanie-ieremii" },
    { name: "Молитва Азарии и песнь трёх отроков", slug: "pesn-trekh-otrokov" },
    { name: "3-я Ездры", slug: "3-ezdry" },
    { name: "Премудрости Соломона", slug: "premudrosti-solomona" },
    { name: "Премудрости Иисуса, сына Сирахова", slug: "sirakha" },
    { name: "История Сусанны", slug: "susanny" },
    { name: "Вил и дракон", slug: "vil-i-drakon" },
    { name: "1-я Маккавейская", slug: "1-makkaveyskaya" },
    { name: "2-я Маккавейская", slug: "2-makkaveyskaya" },
    { name: "3-я Маккавейская", slug: "3-makkaveyskaya" },
    { name: "От Матфея", slug: "matfeya" },
    { name: "От Марка", slug: "marka" },
    { name: "От Луки", slug: "luki" },
    { name: "От Иоанна", slug: "ioanna" },
    { name: "Деяния апостолов", slug: "deyaniya" },
    { name: "К Римлянам", slug: "rimlyanam" },
    { name: "1-е Коринфянам", slug: "1-korinfyanam" },
    { name: "2-е Коринфянам", slug: "2-korinfyanam" },
    { name: "К Галатам", slug: "galatam" },
    { name: "К Ефесянам", slug: "efesyanam" },
    { name: "К Филиппийцам", slug: "filippiytsam" },
    { name: "К Колоссянам", slug: "kolossyanam" },
    { name: "1-е Фессалоникийцам", slug: "1-fessaloniyitsam" },
    { name: "2-е Фессалоникийцам", slug: "2-fessaloniyitsam" },
    { name: "1-е Тимофею", slug: "1-timofeyu" },
    { name: "2-е Тимофею", slug: "2-timofeyu" },
    { name: "К Титу", slug: "titu" },
    { name: "К Филимону", slug: "filimonu" },
    { name: "К Евреям", slug: "evreyam" },
    { name: "Иакова", slug: "iakova" },
    { name: "1-е Петра", slug: "1-petra" },
    { name: "2-е Петра", slug: "2-petra" },
    { name: "1-е Иоанна", slug: "1-ioanna-posl" },
    { name: "2-е Иоанна", slug: "2-ioanna-posl" },
    { name: "3-е Иоанна", slug: "3-ioanna-posl" },
    { name: "Иуды", slug: "iudy" },
    { name: "Откровение", slug: "otkrovenie" },
];

interface IBookSegment {
    title: string;
    body: string;
}

const splitIntoBooks = (raw: string): IBookSegment[] => {
    const headerPattern = /^===== (.+) =====$/gm;
    const matches = [...raw.matchAll(headerPattern)];
    return matches.map((m, i) => {
        const title = m[1];
        const start = m.index! + m[0].length;
        const end = i + 1 < matches.length ? matches[i + 1].index! : raw.length;
        return { title, body: raw.slice(start, end) };
    });
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
    const raw = fs.readFileSync(FILE_PATH, "utf-8");
    const segments = splitIntoBooks(raw);

    console.log(`Найдено книг в файле: ${segments.length} (пропускаем первую — уже импортирована вручную)`);

    const rest = segments.slice(1);
    if (rest.length !== RU_BOOKS.length) {
        throw new Error(
            `Число книг в файле после Бытия (${rest.length}) не совпадает с таблицей названий (${RU_BOOKS.length}). ` +
            `Прерываю импорт, чтобы не насажать книги под неверными названиями.`
        );
    }

    const client = await clientPromise;
    const db = client.db("typikon");

    let bookIndex = 2; // Бытие уже занимает 1
    let totalVerses = 0;
    const insertedTextIds: ObjectId[] = [];

    for (let i = 0; i < rest.length; i++) {
        const { title, body } = rest[i];
        const { name: ruName, slug } = RU_BOOKS[i];
        const rows = parseBulkVerseText(body);

        if (rows.length === 0) {
            console.warn(`!! ${title} (${ruName}) — не удалось распарсить ни одного стиха, пропускаю`);
            continue;
        }

        const textId = new ObjectId();
        const alias = `biblia-rom-${slug}-${bookIndex}`;

        await db.collection("texts").insertOne({
            _id: textId,
            name: `${title} (${ruName})`,
            content: "",
            description: `${ruName} на румынском языке в валашской кириллице`,
            start: "",
            fileId: null,
            link: SOURCE_LINK,
            ruLink: "",
            bookId: BOOK_ID,
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
        totalVerses += rows.length;
        console.log(`${bookIndex}. ${title} (${ruName}) — ${rows.length} стихов, alias=${alias}`);

        bookIndex++;
    }

    await db.collection("books").updateOne(
        { _id: BOOK_ID },
        { $push: { texts: { $each: insertedTextIds } } as any, $set: { updatedAt: new Date() } }
    );

    console.log(`\nГотово: добавлено книг — ${insertedTextIds.length}, стихов всего — ${totalVerses}`);
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
