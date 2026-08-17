// Импорт заготовок текстов ("в наличии" / PRESENCE) из contents/*.json — оглавлений книг,
// собранных отдельным заходом (Лавсаик, Феофилакт на Луку/Марка, Беседы на Матфея/Бытие,
// Толковый апостол, Толкование на Апокалипсис, Торжественник триодный постный).
//
// Логика:
//  - для каждой книги ищем существующую запись в books по имени; если нет — создаём;
//  - для каждой позиции оглавления создаём text-заготовку (readiness=PRESENCE, content=""),
//    ПРОПУСКАЯ позиции, явно помеченные в JSON как уже существующие в БД
//    (status/status_hint === "existing_in_db" — эти тексты уже отекстованы вручную ранее);
//  - идемпотентность: перед вставкой проверяем, нет ли уже текста с тем же bookId+name+bookIndex
//    (созданного этим же скриптом при предыдущем запуске) — повторный запуск не плодит дубли.
//
// Запуск: npx tsx src/scripts/import-content-stubs.ts        (реальная запись)
//         DRY_RUN=1 npx tsx src/scripts/import-content-stubs.ts  (только подсчёт, без записи)
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import * as fs from "fs";
import * as path from "path";
import { TextKind, TextReadiness } from "@/utils/texts";

const DRY_RUN = process.env.DRY_RUN === "1";
const CONTENTS_DIR = path.join(process.cwd(), "contents");

const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(CONTENTS_DIR, file), "utf-8"));

interface IStubItem {
    name: string;
    description?: string;
    bookIndex?: number | null;
    type: string;
    author?: string;
    ruLink?: string | null;
    adminInfo?: string;
}

interface IBookSpec {
    dbName: string;
    createIfMissing?: { author: string; description: string; translator?: string };
    items: IStubItem[];
}

const azbykaMatfeya = (n: number) => `https://azbyka.ru/otechnik/Ioann_Zlatoust/besedy-na-evangelie-ot-matfeja/${n}`;
const azbykaBytie = (n: number) => `https://azbyka.ru/otechnik/Ioann_Zlatoust/besedy-na-knigu-bytija/${n}`;
const azbykaLuka = (n: number) => n > 0
    ? `https://azbyka.ru/otechnik/Feofilakt_Bolgarskij/tolkovanie-na-evangelie-ot-luki/${n}`
    : `https://azbyka.ru/otechnik/Feofilakt_Bolgarskij/tolkovanie-na-evangelie-ot-luki/`;
const azbykaMarka = (n: number) => n > 0
    ? `https://azbyka.ru/otechnik/Feofilakt_Bolgarskij/tolkovanie-na-evangelie-ot-marka/${n}`
    : `https://azbyka.ru/otechnik/Feofilakt_Bolgarskij/tolkovanie-na-evangelie-ot-marka/`;

const buildLavsaik = (): IBookSpec => {
    const data = readJson("lavsaik.json");
    const items: IStubItem[] = data.chapters
        .filter((c: any) => c.status_hint !== "existing_in_db")
        .map((c: any) => ({
            name: c.title,
            description: [c.start, c.folio ? `(${c.folio})` : null].filter(Boolean).join(" — ") || undefined,
            bookIndex: c.number,
            type: TextKind.SYNAXARION,
            author: "",
            adminInfo: c.note || undefined,
        }));
    return { dbName: "Лавсаик", items };
};

const buildFeofilaktLuka = (): IBookSpec => {
    const data = readJson("feofilakt-luka.json");
    const items: IStubItem[] = data.chapters.map((c: any) => ({
        name: c.title,
        description: c.description,
        bookIndex: c.number,
        type: TextKind.INTERPRETATION,
        author: "Феофилакт Болгарский",
        ruLink: azbykaLuka(c.number),
    }));
    return {
        dbName: "Толковое Евангелие от Луки",
        createIfMissing: {
            author: "Феофилакт Болгарский",
            description: "Толкование блаженного Феофилакта Болгарского на святое Евангелие от Луки",
        },
        items,
    };
};

const buildFeofilaktMarka = (): IBookSpec => {
    const data = readJson("feofilakt-marka.json");
    const items: IStubItem[] = data.chapters.map((c: any) => ({
        name: c.title,
        description: c.description,
        bookIndex: c.number,
        type: TextKind.INTERPRETATION,
        author: "Феофилакт Болгарский",
        ruLink: azbykaMarka(c.number),
    }));
    return {
        dbName: "Толковое Евангелие от Марка",
        createIfMissing: {
            author: "Феофилакт Болгарский",
            description: "Толкование блаженного Феофилакта Болгарского на святое Евангелие от Марка",
        },
        items,
    };
};

const buildBesedyMatfeya = (): IBookSpec => {
    const data = readJson("besedy-na-matfeya.json");
    const items: IStubItem[] = data.chapters
        .filter((c: any) => c.status_hint !== "existing_in_db")
        .map((c: any) => ({
            name: c.title,
            description: `${c.description} (${c.scripture_ref})`,
            bookIndex: c.number,
            type: TextKind.TEACHIND,
            author: "Иоанн Златоуст",
            ruLink: azbykaMatfeya(c.number),
        }));
    return { dbName: "Беседы на Евангелие от Матфея", items };
};

const buildBesedyBytie = (): IBookSpec => {
    const data = readJson("besedy-na-bytie.json");
    const items: IStubItem[] = data.chapters
        .filter((c: any) => c.status_hint !== "existing_in_db")
        .map((c: any) => ({
            name: c.title,
            bookIndex: c.number,
            type: TextKind.TEACHIND,
            author: "Иоанн Златоуст",
            ruLink: azbykaBytie(c.number),
        }));
    return { dbName: "Беседы на Бытие", items };
};

const buildApostol = (): IBookSpec => {
    const data = readJson("tolkovyy-apostol.json");
    const items: IStubItem[] = [];
    for (const section of data.sections) {
        for (const z of section.zachala) {
            items.push({
                name: z.title,
                description: `Толковый апостол, ${section.book_name}, зачало ${z.number} (${z.scripture_ref})`,
                bookIndex: typeof z.number === "number" ? z.number : null,
                type: TextKind.INTERPRETATION,
                author: "",
                adminInfo: z.note || undefined,
            });
        }
    }
    return { dbName: "Толковый апостол", items };
};

const buildApokalipsis = (): IBookSpec => {
    const data = readJson("apokalipsis.json");
    const items: IStubItem[] = data.chapters.map((c: any) => ({
        name: c.title,
        description: `${c.description} (${c.scripture_ref}; статьи ${c.article_range})`,
        bookIndex: c.number,
        type: TextKind.INTERPRETATION,
        author: "Андрей Кесарийский",
    }));
    return {
        dbName: "Толкование на Апокалипсис",
        createIfMissing: {
            author: "Андрей Кесарийский",
            description: data.description,
        },
        items,
    };
};

const buildTorzhestvennikPostnyy = (): IBookSpec => {
    const data = readJson("torzhestvennik-triodnyy-postnyy.json");
    const items: IStubItem[] = [];
    for (const week of data.weeks) {
        for (const it of week.items) {
            if (it.status === "existing_in_db") continue;
            items.push({
                name: it.title,
                description: [week.period, it.description].filter(Boolean).join(" — "),
                bookIndex: typeof it.number === "number" ? it.number : null,
                type: TextKind.TEACHIND,
                author: (it.author || "").replace(/\s*\(.*?\)\s*$/, ""), // убираем пометки вида "(приписываемое)" из имени автора
                adminInfo: [it.author, it.status === "uncertain" ? "атрибуция/состав требует проверки" : null]
                    .filter(Boolean).join("; ") || undefined,
            });
        }
    }
    return { dbName: "Торжественник триодный (постный)", items };
};

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");
    const booksCol = db.collection("books");
    const textsCol = db.collection("texts");

    const specs = [
        buildLavsaik(),
        buildFeofilaktLuka(),
        buildFeofilaktMarka(),
        buildBesedyMatfeya(),
        buildBesedyBytie(),
        buildApostol(),
        buildApokalipsis(),
        buildTorzhestvennikPostnyy(),
    ];

    const allBooks = await booksCol.find({}).toArray();
    let maxOrder = allBooks.reduce((m, b) => Math.max(m, typeof b.order === "number" ? b.order : 0), 0);

    let totalCreated = 0;
    let totalSkippedExisting = 0;
    let totalSkippedDup = 0;

    for (const spec of specs) {
        let book = allBooks.find(b => b.name === spec.dbName);
        if (!book) {
            if (!spec.createIfMissing) {
                console.error(`!! книга "${spec.dbName}" не найдена в БД и не помечена как создаваемая — пропуск`);
                continue;
            }
            maxOrder += 1;
            const newBookDoc = {
                name: spec.dbName,
                author: spec.createIfMissing.author,
                translator: spec.createIfMissing.translator || "",
                description: spec.createIfMissing.description,
                fileId: null,
                texts: [] as ObjectId[],
                order: maxOrder,
                updatedAt: new Date(),
            };
            console.log(`${DRY_RUN ? "[DRY] " : ""}Создаю книгу "${spec.dbName}" (order=${maxOrder})`);
            if (!DRY_RUN) {
                const ins = await booksCol.insertOne(newBookDoc);
                book = { ...newBookDoc, _id: ins.insertedId };
            } else {
                book = { ...newBookDoc, _id: new ObjectId() };
            }
            allBooks.push(book);
        }

        // Ключ дедупликации включает description, а не только name+bookIndex: в Толковом
        // апостоле несколько разных зачал (напр. на стыке 2 Пет./1 Ин. или Тит./Флм.)
        // по самой печатной нумерации делят один и тот же номер ("зачало 68", "302Б"),
        // так что имя+bookIndex у них совпадают, а описание (со ссылкой на книгу/стихи) — нет.
        const existingTextsOfBook = await textsCol.find({ bookId: book._id }).project({ name: 1, bookIndex: 1, description: 1 }).toArray();
        const existingKey = new Set(existingTextsOfBook.map(t => `${t.name}::${t.bookIndex ?? ""}::${t.description ?? ""}`));

        const newDocs: any[] = [];
        for (const item of spec.items) {
            const key = `${item.name}::${item.bookIndex ?? ""}::${item.description ?? ""}`;
            if (existingKey.has(key)) {
                totalSkippedDup += 1;
                continue;
            }
            existingKey.add(key); // защита от дублей внутри самого набора (напр. повторяющиеся bookIndex в Апостоле/Торжественнике)
            newDocs.push({
                name: item.name,
                content: "",
                description: item.description || "",
                start: "",
                fileId: null,
                link: null,
                ruLink: item.ruLink || null,
                bookId: book._id,
                footnotes: [],
                author: item.author || "",
                translator: "",
                type: item.type,
                readiness: TextReadiness.PRESENCE,
                ...(item.bookIndex != null ? { bookIndex: item.bookIndex } : {}),
                ...(item.adminInfo ? { adminInfo: item.adminInfo } : {}),
                createdAt: new Date(),
            });
        }

        console.log(
            `${DRY_RUN ? "[DRY] " : ""}${spec.dbName}: к созданию ${newDocs.length}, ` +
            `пропущено (уже в БД по имени) ${spec.items.length - newDocs.length}`
        );

        if (newDocs.length > 0 && !DRY_RUN) {
            const ins = await textsCol.insertMany(newDocs);
            const insertedIds = Object.values(ins.insertedIds) as ObjectId[];
            await booksCol.updateOne(
                { _id: book._id },
                { $addToSet: { texts: { $each: insertedIds } }, $set: { updatedAt: new Date() } }
            );
        }

        totalCreated += newDocs.length;
    }

    console.log(`\nИтого: создано заготовок ${totalCreated}, пропущено как дубли ${totalSkippedDup}${DRY_RUN ? " (DRY RUN — ничего не записано)" : ""}`);
};

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
