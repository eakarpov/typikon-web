// Сверка версификации изданий Библии: где у них расходится состав книг и длина глав.
//
// Зачем. Резолюция зачал устроена так, будто одинаковая пара «глава:стих» означает
// один и тот же стих в любом издании. В наших данных это уже неправда: в
// Елизаветинской Библии Сусанна и Вил — 13-я и 14-я главы Даниила, а в румынской
// 1688 года они изданы отдельными книгами; из-за этого паремия «Дан. 3:1–88»
// отдаёт на румынском 33 стиха вместо 88 — молча, без всякой пометки.
//
// Скрипт ничего не чинит. Он показывает ВСЕ расхождения разом, чтобы правила
// приведения к канону (src/lib/bible/mappings.ts) писались по разбору данных, а не
// по памяти о трёх известных случаях.
//
// Эталон — церковнославянское издание: оно же фолбек сайта, оно же славянская
// традиция LXX, на которую опирается устав. Румынское сверяется против него.
//
// В БАЗУ НЕ ПИШЕТ. Пишет два файла:
//   BIBLE_VERSIFICATION.md          — отчёт для чтения глазами;
//   src/utils/bibleVersification.ts — эталонные длины глав, для кода.
//
// Запуск: npx tsx src/scripts/audit-bible-versification.ts
import "@/scripts/lib/env";
import fs from "fs";
import path from "path";
import { Db, ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { BIBLE_CANON, canonBook } from "@/utils/bibleCanon";

const REPORT_PATH = path.join(process.cwd(), "BIBLE_VERSIFICATION.md");
const REFERENCE_PATH = path.join(process.cwd(), "src/utils/bibleVersification.ts");

/** Эталонное издание идёт первым: остальные сверяются против него. */
const EDITIONS = [
    { lang: "cs", title: "Елизаветинская (церковнославянская)" },
    { lang: "ro", title: "Сфънта Скриптура (румынская, 1688)" },
];

interface BookShape {
    /** Значение texts.bibleBookSlug — оно же идентификатор канона, если книга в каноне. */
    slug: string;
    name: string;
    alias: string;
    bookIndex: number | null;
    /** Длины глав по возрастанию номера главы. */
    chapters: Array<{ chapter: number; verses: number; missing: number[]; duplicates: number[] }>;
}

interface EditionShape {
    lang: string;
    title: string;
    bookName: string;
    books: Map<string, BookShape>;
}

const readEdition = async (db: Db, lang: string, title: string): Promise<EditionShape | null> => {
    const book = await db.collection("books").findOne({ bibleLanguageCode: lang });
    if (!book) {
        console.warn(`!! издания с bibleLanguageCode=${lang} в базе нет — пропускаю`);
        return null;
    }

    const texts = await db.collection("texts")
        .find({ bookId: book._id }, { projection: { name: 1, alias: 1, bibleBookSlug: 1, bookIndex: 1 } })
        .toArray();

    const books = new Map<string, BookShape>();

    for (const text of texts) {
        const verses = await db.collection("verses")
            .find({ textId: text._id }, { projection: { chapter: 1, verse: 1 } })
            .toArray();

        // Группируем по главам сами, а не distinct-ом: заодно видны дыры и повторы
        // в нумерации, которых distinct не покажет.
        const byChapter = new Map<number, number[]>();
        verses.forEach((v) => {
            const list = byChapter.get(v.chapter) || [];
            list.push(v.verse);
            byChapter.set(v.chapter, list);
        });

        const chapters = [...byChapter.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([chapter, numbers]) => {
                const sorted = [...numbers].sort((a, b) => a - b);
                const seen = new Set<number>();
                const duplicates: number[] = [];
                sorted.forEach((n) => (seen.has(n) ? duplicates.push(n) : seen.add(n)));

                const missing: number[] = [];
                for (let n = 1; n <= sorted[sorted.length - 1]; n++) {
                    if (!seen.has(n)) missing.push(n);
                }

                return { chapter, verses: sorted.length, missing, duplicates };
            });

        const slug = (text.bibleBookSlug as string) || `?${text.alias || text._id}`;
        books.set(slug, {
            slug,
            name: text.name as string,
            alias: (text.alias as string) || "",
            bookIndex: (text.bookIndex as number) ?? null,
            chapters,
        });
    }

    return { lang, title, bookName: book.name as string, books };
};

const totalVerses = (book: BookShape) =>
    book.chapters.reduce((sum, chapter) => sum + chapter.verses, 0);

const section = (title: string) => `\n## ${title}\n`;

const buildReport = (editions: EditionShape[]): string => {
    const [reference, ...others] = editions;
    const lines: string[] = [];

    lines.push("# Сверка версификации изданий Библии");
    lines.push("");
    lines.push("Отчёт собран `npx tsx src/scripts/audit-bible-versification.ts`. Правила приведения");
    lines.push("к канону пишутся по нему — см. `src/lib/bible/mappings.ts`.");
    lines.push("");
    lines.push(`Эталон — **${reference.title}**.`);

    lines.push(section("Издания"));
    lines.push("| издание | книг | глав | стихов |");
    lines.push("|---|---:|---:|---:|");
    editions.forEach((edition) => {
        const books = [...edition.books.values()];
        lines.push(
            `| ${edition.title} | ${books.length} | ` +
            `${books.reduce((s, b) => s + b.chapters.length, 0)} | ` +
            `${books.reduce((s, b) => s + totalVerses(b), 0)} |`,
        );
    });

    // --- состав книг
    lines.push(section("Книги вне канона"));
    const strays = editions.flatMap((edition) =>
        [...edition.books.values()]
            .filter((book) => !canonBook(book.slug))
            .map((book) => ({ edition, book })),
    );
    if (!strays.length) {
        lines.push("Нет: каждая книга каждого издания опознана в каноне.");
    } else {
        lines.push("Это и есть кандидаты на правило приведения: книга издана отдельно,");
        lines.push("а в каноне она — часть другой книги.");
        lines.push("");
        lines.push("| издание | слуг | название | глав | стихов |");
        lines.push("|---|---|---|---:|---:|");
        strays.forEach(({ edition, book }) => {
            lines.push(
                `| ${edition.lang} | \`${book.slug}\` | ${book.name} | ` +
                `${book.chapters.length} | ${totalVerses(book)} |`,
            );
        });
    }

    lines.push(section("Состав относительно канона"));
    lines.push("| книга канона | " + editions.map((e) => e.lang).join(" | ") + " |");
    lines.push("|---|" + editions.map(() => "---").join("|") + "|");
    BIBLE_CANON.forEach((canon) => {
        const cells = editions.map((edition) => (edition.books.has(canon.id) ? "есть" : "**нет**"));
        if (cells.some((cell) => cell !== "есть")) {
            lines.push(`| ${canon.name} (\`${canon.id}\`) | ${cells.join(" | ")} |`);
        }
    });

    // --- расхождения длин
    others.forEach((edition) => {
        lines.push(section(`Расхождения: ${edition.title}`));

        const rows: string[] = [];
        BIBLE_CANON.forEach((canon) => {
            const mine = edition.books.get(canon.id);
            const theirs = reference.books.get(canon.id);
            if (!mine || !theirs) return;

            if (mine.chapters.length !== theirs.chapters.length) {
                rows.push(
                    `| ${canon.name} | глав | ${theirs.chapters.length} | ${mine.chapters.length} |`,
                );
            }

            const byChapter = new Map(mine.chapters.map((c) => [c.chapter, c.verses]));
            theirs.chapters.forEach((chapter) => {
                const here = byChapter.get(chapter.chapter);
                if (here === undefined) {
                    rows.push(`| ${canon.name} | гл. ${chapter.chapter} | ${chapter.verses} | **нет** |`);
                } else if (here !== chapter.verses) {
                    rows.push(`| ${canon.name} | гл. ${chapter.chapter} | ${chapter.verses} | ${here} |`);
                }
            });
        });

        if (!rows.length) {
            lines.push("Длины глав сходятся во всех общих книгах.");
        } else {
            lines.push(`Расхождений: **${rows.length}**.`);
            lines.push("");
            lines.push(`| книга | место | эталон (${reference.lang}) | ${edition.lang} |`);
            lines.push("|---|---|---:|---:|");
            lines.push(...rows);
        }
    });

    // --- пропущенные главы
    //
    // Считается отдельно от дыр внутри главы: пропущенная глава — это не сбитый
    // номер стиха, а отсутствующий кусок книги, и в эталонной таблице она даёт ноль.
    lines.push(section("Пропущенные главы"));
    const chapterGaps: string[] = [];
    editions.forEach((edition) => {
        [...edition.books.values()].forEach((book) => {
            const present = new Set(book.chapters.map((c) => c.chapter));
            const last = book.chapters[book.chapters.length - 1]?.chapter ?? 0;
            const missing: number[] = [];
            for (let chapter = 1; chapter <= last; chapter++) {
                if (!present.has(chapter)) missing.push(chapter);
            }
            if (missing.length) {
                chapterGaps.push(
                    `| ${edition.lang} | ${book.name} | ${missing.join(", ")} | ${last} |`,
                );
            }
        });
    });
    if (!chapterGaps.length) {
        lines.push("Нет: в каждой книге обоих изданий главы идут подряд.");
    } else {
        lines.push("| издание | книга | нет глав | последняя глава |");
        lines.push("|---|---|---|---:|");
        lines.push(...chapterGaps);
    }

    // --- целость нумерации
    lines.push(section("Дыры и повторы в нумерации"));
    const broken: string[] = [];
    editions.forEach((edition) => {
        [...edition.books.values()].forEach((book) => {
            book.chapters.forEach((chapter) => {
                if (chapter.missing.length) {
                    broken.push(
                        `| ${edition.lang} | ${book.name} | гл. ${chapter.chapter} | пропущены | ` +
                        `${chapter.missing.slice(0, 20).join(", ")}${chapter.missing.length > 20 ? " …" : ""} |`,
                    );
                }
                if (chapter.duplicates.length) {
                    broken.push(
                        `| ${edition.lang} | ${book.name} | гл. ${chapter.chapter} | повторяются | ` +
                        `${chapter.duplicates.slice(0, 20).join(", ")}${chapter.duplicates.length > 20 ? " …" : ""} |`,
                    );
                }
            });
        });
    });
    if (!broken.length) {
        lines.push("Нумерация сплошная во всех книгах обоих изданий.");
    } else {
        lines.push("| издание | книга | глава | что | стихи |");
        lines.push("|---|---|---|---|---|");
        lines.push(...broken);
    }

    return lines.join("\n") + "\n";
};

const buildReference = (reference: EditionShape): string => {
    const incomplete: string[] = [];

    const entries = BIBLE_CANON
        .filter((canon) => reference.books.has(canon.id))
        .map((canon) => {
            const book = reference.books.get(canon.id)!;
            // Длины по номеру главы, а не по порядку записей: если в главах есть
            // дыра, таблица должна её сохранить, а не сдвинуть остальные главы.
            const last = book.chapters[book.chapters.length - 1]?.chapter ?? 0;
            const lengths = Array.from({ length: last }, (_, i) =>
                book.chapters.find((c) => c.chapter === i + 1)?.verses ?? 0);

            const zeros = lengths
                .map((length, i) => (length === 0 ? i + 1 : 0))
                .filter(Boolean);
            if (zeros.length) {
                incomplete.push(`//   ${canon.name} (${canon.id}) — главы ${zeros.join(", ")}`);
            }

            return `    "${canon.id}": [${lengths.join(", ")}],`;
        });

    const warning = incomplete.length
        ? [
            "//",
            "// НЕПОЛНЫЕ КНИГИ. У эталона есть главы без единого пронумерованного стиха —",
            "// в источнике (bible.by/elzs) их текст напечатан сплошняком, без стиховой",
            "// разбивки. Такая глава стоит нулём, и зачало из неё не срезолвится ни в",
            "// одном издании. Список:",
            ...incomplete,
        ]
        : [];

    return [
        "// Эталонная версификация — длины глав Елизаветинской Библии.",
        "//",
        "// СОБРАНО СКРИПТОМ, РУКАМИ НЕ ПРАВИТЬ: пересобирается командой",
        "// `npx tsx src/scripts/audit-bible-versification.ts` вместе с отчётом",
        "// BIBLE_VERSIFICATION.md.",
        "//",
        "// Церковнославянское издание взято эталоном не по старшинству, а по роли: оно",
        "// же запасной язык чтений на сайте и та самая славянская традиция LXX, в чьей",
        "// нумерации записаны все зачала устава.",
        "//",
        "// Индекс в массиве — номер главы минус один; значение — сколько в ней стихов.",
        "// Ноль означает главу, которой в издании нет вовсе.",
        ...warning,
        "",
        "export const REFERENCE_VERSIFICATION: Record<string, number[]> = {",
        ...entries,
        "};",
        "",
        "/** Длины глав книги канона; null — книги нет в эталоне. */",
        "export const referenceChapterLengths = (canonId: string): number[] | null =>",
        "    REFERENCE_VERSIFICATION[canonId] ?? null;",
        "",
        "/** Сколько глав в книге по эталону. */",
        "export const referenceChapterCount = (canonId: string): number =>",
        "    REFERENCE_VERSIFICATION[canonId]?.length ?? 0;",
        "",
    ].join("\n");
};

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");

    const editions: EditionShape[] = [];
    for (const { lang, title } of EDITIONS) {
        const edition = await readEdition(db, lang, title);
        if (edition) editions.push(edition);
    }

    if (!editions.length) {
        console.error("Изданий Библии в базе не найдено.");
        process.exit(1);
    }

    fs.writeFileSync(REPORT_PATH, buildReport(editions), "utf-8");
    console.log(`Отчёт: ${path.relative(process.cwd(), REPORT_PATH)}`);

    fs.writeFileSync(REFERENCE_PATH, buildReference(editions[0]), "utf-8");
    console.log(`Эталон: ${path.relative(process.cwd(), REFERENCE_PATH)} (${editions[0].books.size} книг)`);
};

main().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
});
