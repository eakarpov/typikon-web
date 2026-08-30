// Сверка переноса Библий: совпадает ли новая модель со старой там, где обязана,
// и где именно расходится там, где расходиться и должна.
//
// Главная проверка — зачала. Их 1067, и каждое ведёт на службу: если после переноса
// хоть одно стало отдавать другой набор стихов, это ошибка не в базе, а в чтении на
// клиросе. Поэтому церковнославянский резолв обязан совпасть СТИХ В СТИХ со старым:
// правил приведения у эталонного издания нет, значит и меняться нечему.
//
// Румынский резолв, наоборот, обязан разойтись — ради этого всё и делалось.
// Расхождения печатаются поимённо: каждое должно объясняться правилом из
// @/lib/bible/mappings, а не оказаться сюрпризом.
//
// Ничего не пишет. Возвращает ненулевой код, если сверка не сошлась.
//
// Запуск: npx tsx src/scripts/verify-bible-migration.ts
import "@/scripts/lib/env";
import { Db } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { filterVersesByRanges, sortVerses } from "@/utils/verses";
import { editionForLang, versesForCanonRanges } from "@/lib/bible/query";
import { BIBLE_BOOKS, BIBLE_EDITIONS, BIBLE_VERSES } from "@/lib/bible/schema";

/**
 * Прежняя резолюция зачала — books по языку, texts по слугу, verses по chapter:verse.
 *
 * Держится копией здесь, а не импортом из @/lib/pericopes: тот резолв уже переписан
 * на новую модель, и сравнивать его с самим собой бессмысленно. Копия живёт ровно
 * до уборки старых коллекций и уходит вместе с ними.
 */
const legacyResolve = async (db: Db, pericope: any, lang: string) => {
    const book = await db.collection("books").findOne({ bibleLanguageCode: lang });
    if (!book) return [];

    const text = await db.collection("texts").findOne({ bookId: book._id, bibleBookSlug: pericope.bookSlug });
    if (!text) return [];

    const raw = await db.collection("verses").find({ textId: text._id }).toArray();
    const sorted = sortVerses(raw.map((v) => ({ ...(v as any), id: v._id.toString() })));
    return filterVersesByRanges(sorted, pericope.ranges || []);
};

let failures = 0;

const check = (ok: boolean, label: string, detail = "") => {
    console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};

const checkCounts = async (db: Db) => {
    console.log("\n== Объёмы ==");

    const [legacyTexts, legacyVerses, editions, books, verses] = await Promise.all([
        db.collection("texts").countDocuments({ contentType: "verses" }),
        db.collection("verses").countDocuments(),
        db.collection(BIBLE_EDITIONS).countDocuments(),
        db.collection(BIBLE_BOOKS).countDocuments(),
        db.collection(BIBLE_VERSES).countDocuments(),
    ]);

    check(editions === 2, "изданий перенесено", `${editions}`);
    check(books === legacyTexts, "книг", `было ${legacyTexts}, стало ${books}`);
    check(verses === legacyVerses, "стихов", `было ${legacyVerses}, стало ${verses}`);
};

// Идентификаторы сохранены не для красоты: на них ссылаются заметки читателей и
// правки ударений. Проверяем не выборочно, а сплошь — потерянный стих иначе
// обнаружится только тогда, когда кто-то откроет главу.
const checkVerseIdentity = async (db: Db) => {
    console.log("\n== Сохранность стихов ==");

    const legacy = await db.collection("verses")
        .find({}, { projection: { content: 1 } })
        .toArray();
    const migrated = new Map(
        (await db.collection(BIBLE_VERSES).find({}, { projection: { content: 1 } }).toArray())
            .map((doc) => [doc._id.toString(), doc.content as string]),
    );

    let missing = 0;
    let changed = 0;
    legacy.forEach((doc) => {
        const content = migrated.get(doc._id.toString());
        if (content === undefined) missing++;
        else if (content !== (doc.content ?? "")) changed++;
    });

    check(missing === 0, "каждый старый стих найден по своему _id", `не найдено ${missing}`);
    check(changed === 0, "содержимое стихов не изменилось", `разошлось ${changed}`);
};

const checkCanonRefs = async (db: Db) => {
    console.log("\n== Канонические ссылки ==");

    const broken = await db.collection(BIBLE_VERSES).countDocuments({
        $or: [
            { canonRef: { $in: [null, ""] } },
            { canonSort: { $lte: 0 } },
            { canonChapter: { $lte: 0 } },
            { canonVerse: { $lte: 0 } },
        ],
    });
    check(broken === 0, "у каждого стиха есть каноническая ссылка", `без ссылки ${broken}`);

    // Один канонический стих на издание — иначе параллель начала бы двоиться.
    const duplicates = await db.collection(BIBLE_VERSES).aggregate([
        { $group: { _id: { editionId: "$editionId", canonRef: "$canonRef" }, n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } },
        { $limit: 20 },
    ]).toArray();
    check(
        duplicates.length === 0,
        "канонические ссылки внутри издания не двоятся",
        duplicates.length ? `${duplicates.length} повторов, напр. ${duplicates[0]._id.canonRef}` : "",
    );
};

const idsOf = (verses: Array<{ id?: string; _id?: any }>): string =>
    verses.map((v) => (v.id ?? v._id?.toString())).join(",");

const checkPericopes = async (db: Db) => {
    const pericopes = await db.collection("pericopes").find({}).toArray();
    console.log(`\n== Зачала (${pericopes.length}) ==`);

    for (const lang of ["cs", "ro"]) {
        const edition = await editionForLang(db, lang);
        if (!edition) {
            check(false, `издание для языка ${lang}`, "не найдено");
            continue;
        }

        let same = 0;
        let differ = 0;
        // Разбираем расхождения по знаку: стало стихов больше — правило дотянулось
        // до того, что раньше терялось; меньше или ноль — потеря, и это регрессия
        // на любом языке, а не «ожидаемое расхождение».
        let gained = 0;
        let lost = 0;
        const examples: string[] = [];
        const losses: string[] = [];

        for (const pericope of pericopes) {
            const oldVerses = await legacyResolve(db, pericope, lang);
            const fresh = await versesForCanonRanges(
                db, edition._id, pericope.bookSlug, pericope.ranges || [],
            );

            if (!oldVerses.length && !fresh.length) continue;

            if (idsOf(oldVerses) === idsOf(fresh)) {
                same++;
                continue;
            }

            differ++;
            const line = `${pericope.label}: было ${oldVerses.length}, стало ${fresh.length}`;
            if (fresh.length > oldVerses.length) {
                gained++;
                if (examples.length < 12) examples.push(line);
            } else {
                lost++;
                if (losses.length < 12) losses.push(line);
            }
        }

        console.log(`\n  --- ${lang} (${edition.code}) ---`);
        if (lang === "cs") {
            // Эталон правилами не трогали: любое расхождение здесь — регрессия.
            check(differ === 0, "резолв совпал со старым", `совпало ${same}, разошлось ${differ}`);
        } else {
            console.log(`  совпало ${same}, стало полнее ${gained}`);
            check(lost === 0, "ни одно зачало не потеряло стихов", `потеряло ${lost}`);
        }

        if (examples.length) {
            console.log("  стало полнее:");
            examples.forEach((line) => console.log(`    ${line}`));
        }
        if (losses.length) {
            console.log("  ПОТЕРЯЛИ СТИХИ:");
            losses.forEach((line) => console.log(`    ${line}`));
        }
    }
};

// Тот самый случай, ради которого всё затевалось: паремия на Великую субботу.
// Держим отдельной проверкой, а не примером в отчёте, — чтобы починка не смогла
// тихо развалиться обратно.
const checkDaniel = async (db: Db) => {
    console.log("\n== Дан. 3:1–88 ==");

    const pericope = await db.collection("pericopes").findOne({
        bookSlug: "daniila",
        "ranges.chapterFrom": 3,
    });
    if (!pericope) {
        check(false, "паремия Дан. 3 найдена в базе");
        return;
    }

    for (const [lang, expected] of [["cs", 88], ["ro", 88]] as const) {
        const edition = await editionForLang(db, lang);
        if (!edition) continue;
        const verses = await versesForCanonRanges(db, edition._id, "daniila", pericope.ranges);
        check(verses.length === expected, `${lang}: стихов в чтении`, `${verses.length}, ожидалось ${expected}`);
    }

    const old = await legacyResolve(db, pericope, "ro");
    console.log(`  для сравнения, прежний резолв на румынском отдавал: ${old.length}`);
};

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");

    await checkCounts(db);
    await checkVerseIdentity(db);
    await checkCanonRefs(db);
    await checkPericopes(db);
    await checkDaniel(db);

    console.log(failures ? `\nСВЕРКА НЕ СОШЛАСЬ: ${failures}` : "\nСверка сошлась.");
    process.exit(failures ? 1 : 0);
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
