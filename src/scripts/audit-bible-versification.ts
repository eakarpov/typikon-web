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
// традиция LXX, на которую опирается устав. Остальные сверяются против него.
//
// ЧИТАЕТ bible_editions / bible_books / bible_verses. Раньше читал старые
// `books`/`texts`/`verses` — и перестал работать молча, как только
// drop-legacy-bible.ts их снял: «изданий не найдено» на полной базе.
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
import { isAppendixBook } from "@/utils/bibleAppendix";
import { chapterVerdict, mappingsFor } from "@/lib/bible/mappings";
import { BIBLE_BOOKS, BIBLE_EDITIONS, BIBLE_VERSES } from "@/lib/bible/schema";

const REPORT_PATH = path.join(process.cwd(), "BIBLE_VERSIFICATION.md");
const REFERENCE_PATH = path.join(process.cwd(), "src/utils/bibleVersification.ts");

/** Эталонное издание идёт первым: остальные сверяются против него. */
const EDITIONS = [
    { code: "cs-eliz", lang: "cs", title: "Елизаветинская (церковнославянская)" },
    { code: "ro-1688", lang: "ro", title: "Сфънта Скриптура (румынская, 1688)" },
    { code: "grc-lxx-pat", lang: "grc", title: "Ἡ Ἁγία Γραφή (греческая: Ο΄ и Патриарший 1904)" },
    { code: "la-vulgata", lang: "la", title: "Biblia Sacra Vulgata (латинская, Климентина 1592)" },
];

interface BookShape {
    /** Значение texts.bibleBookSlug — оно же идентификатор канона, если книга в каноне. */
    slug: string;
    name: string;
    alias: string;
    bookIndex: number | null;
    /** Длины глав по возрастанию номера главы. */
    chapters: Array<{ chapter: number; verses: number; missing: number[]; duplicates: number[] }>;
    /** Канонические места, занятые стихами книги, — уже с применёнными правилами. */
    canonRefs: Array<{ chapter: number; verse: number }>;
}

interface EditionShape {
    /** Код издания (bible_editions.code) — по нему находятся его правила приведения. */
    code: string;
    lang: string;
    title: string;
    bookName: string;
    books: Map<string, BookShape>;
}

const readEdition = async (
    db: Db, code: string, lang: string, title: string,
): Promise<EditionShape | null> => {
    const edition = await db.collection(BIBLE_EDITIONS).findOne({ code });
    if (!edition) {
        console.warn(`!! издания «${code}» в базе нет — пропускаю`);
        return null;
    }

    const texts = await db.collection(BIBLE_BOOKS)
        .find({ editionId: edition._id }, { projection: { name: 1, alias: 1, slug: 1, order: 1 } })
        .toArray();

    const books = new Map<string, BookShape>();

    for (const text of texts) {
        // Нумерация берётся РОДНАЯ (chapter/verse), а не каноническая: отчёт для
        // того и нужен, чтобы увидеть, где издание печатает иначе. Сверяй мы
        // canonChapter/canonVerse, уже применённые правила спрятали бы от нас
        // ровно те расхождения, ради которых пишутся следующие.
        const verses = await db.collection(BIBLE_VERSES)
            .find({ bookId: text._id },
                  { projection: { chapter: 1, verse: 1, canonChapter: 1, canonVerse: 1 } })
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

        const canonRefs = verses.map((v) => ({
            chapter: (v.canonChapter as number) ?? v.chapter,
            verse: (v.canonVerse as number) ?? v.verse,
        }));

        const slug = (text.slug as string) || `?${text.alias || text._id}`;
        books.set(slug, {
            slug,
            name: text.name as string,
            alias: (text.alias as string) || "",
            canonRefs,
            bookIndex: (text.order as number) ?? null,
            chapters,
        });
    }

    return { code, lang, title, bookName: edition.title as string, books };
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
    //
    // Книги приложения (@/utils/bibleAppendix) сюда не идут намеренно. Раздел
    // называет КАНДИДАТОВ НА ПРАВИЛО — книгу, изданную отдельно, а в каноне
    // бывшую частью другой. Енох и Оды не таковы: у них нет канонического места
    // и не будет, правило им писать не из чего. Попади они в список, он перестал
    // бы быть списком работы.
    lines.push(section("Книги вне канона"));
    const strays = editions.flatMap((edition) =>
        [...edition.books.values()]
            .filter((book) => !canonBook(book.slug) && !isAppendixBook(book.slug))
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

    // --- приложение
    const inAppendix = editions.flatMap((edition) =>
        [...edition.books.values()]
            .filter((book) => isAppendixBook(book.slug))
            .map((book) => ({ edition, book })),
    );
    if (inAppendix.length) {
        lines.push(section("Приложение: напечатано, но канон не держит"));
        lines.push("Правил приведения этим книгам не нужно — канонического места у них нет,");
        lines.push("адрес у каждой свой (`src/utils/bibleAppendix.ts`).");
        lines.push("");
        lines.push("| издание | слуг | название | глав | стихов |");
        lines.push("|---|---|---|---:|---:|");
        inAppendix.forEach(({ edition, book }) => {
            lines.push(
                `| ${edition.lang} | \`${book.slug}\` | ${book.name} | ` +
                `${book.chapters.length} | ${totalVerses(book)} |`,
            );
        });
    }

    // --- сошлись ли стихи
    //
    // Колонка «приведение» выше говорит про ГЛАВЫ и правила. Здесь — про стихи и
    // про то, что вышло на деле: каждый ли стих издания занял своё, отдельное и
    // существующее место в эталоне. Считается по canonChapter/canonVerse, уже
    // лежащим в базе, то есть проверяется результат, а не намерение.
    //
    // Столкновение значит, что два стиха издания претендуют на одно место, и
    // параллельный вид молча покажет который-нибудь один. Промах — что стих ушёл
    // в главу, где столько стихов не бывает. И то и другое — ошибка правил.
    others.forEach((edition) => {
        const rows: string[] = [];
        BIBLE_CANON.forEach((canon) => {
            const book = edition.books.get(canon.id);
            const reference2 = reference.books.get(canon.id);
            if (!book || !reference2) return;

            const lengths = reference2.chapters.reduce((map, c) => map.set(c.chapter, c.verses),
                                                       new Map<number, number>());
            const taken = new Set<string>();
            let collisions = 0;
            let outside = 0;
            book.canonRefs.forEach((ref) => {
                const key = `${ref.chapter}:${ref.verse}`;
                if (taken.has(key)) collisions++;
                taken.add(key);
                const length = lengths.get(ref.chapter) ?? 0;
                if (ref.verse < 1 || ref.verse > length) outside++;
            });
            if (collisions || outside) {
                rows.push(`| ${edition.lang} | ${canon.name} | ${book.canonRefs.length} | ` +
                          `${collisions} | ${outside} |`);
            }
        });

        lines.push(section(`Сошлись ли стихи: ${edition.title}`));
        if (!rows.length) {
            lines.push("Каждый стих издания занял своё, отдельное и существующее место эталона.");
        } else {
            lines.push("Книги, где это не так. Столкновение — два стиха на одно место;");
            lines.push("промах — стих ушёл в главу, где столько стихов не бывает.");
            lines.push("");
            lines.push("| издание | книга | стихов | столкновений | промахов |");
            lines.push("|---|---|---:|---:|---:|");
            lines.push(...rows);
        }
    });

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

        // Правила издания — чтобы отличить расхождение УЖЕ СВЕДЁННОЕ от открытого.
        // Без этого столбца отчёт врёт как список работы: греческий Иеремия
        // расходится с эталоном двадцатью семью главами и при этом сведён весь,
        // до последнего стиха, — а выглядел бы нетронутым.
        const rules = mappingsFor(edition.code);
        // Глава считается сведённой, если какое-то правило ведёт ИМЕННО В НЕЁ.
        // Проверять «правило упоминает эту книгу» нельзя: правило без to.chapter
        // (сдвиг внутри своей же главы) пометило бы сведённой всю книгу разом, и
        // отчёт как список работы соврал бы в приятную сторону.
        const covered = (book: string, chapter: number) =>
            rules.some((rule) =>
                (rule.from.book === book && rule.from.chapter === chapter)
                || ((rule.to.book ?? rule.from.book) === book && rule.to.chapter === chapter));

        const rows: string[] = [];
        let open = 0;
        BIBLE_CANON.forEach((canon) => {
            const mine = edition.books.get(canon.id);
            const theirs = reference.books.get(canon.id);
            if (!mine || !theirs) return;

            // Четыре состояния, а не два. «—» остаётся только у того, до чего не
            // дошли руки, и только оно идёт в счёт работы: глава, сверенная и
            // признанная верной, — не задолженность, и говорить о ней как о
            // задолженности значит выдумывать себе работу.
            const mark = (chapter: number) => {
                if (covered(canon.id, chapter)) return "правило есть";
                const verdict = chapterVerdict(edition.code, canon.id, chapter);
                if (verdict === "aligned") return "сверено, сдвига нет";
                if (verdict === "unmappable") return "правилом не выразимо";
                open++;
                return "—";
            };

            if (mine.chapters.length !== theirs.chapters.length) {
                // Строка про ЧИСЛО ГЛАВ — сведение, а не единица работы: столбец
                // «приведение» ей нечего сказать, и в счёт открытого она не идёт.
                rows.push(
                    `| ${canon.name} | глав | ${theirs.chapters.length} | ${mine.chapters.length} |  |`,
                );
            }

            const byChapter = new Map(mine.chapters.map((c) => [c.chapter, c.verses]));
            theirs.chapters.forEach((chapter) => {
                const here = byChapter.get(chapter.chapter);
                if (here === undefined) {
                    rows.push(`| ${canon.name} | гл. ${chapter.chapter} | ${chapter.verses} | **нет** | ${mark(chapter.chapter)} |`);
                } else if (here !== chapter.verses) {
                    rows.push(`| ${canon.name} | гл. ${chapter.chapter} | ${chapter.verses} | ${here} | ${mark(chapter.chapter)} |`);
                }
            });
        });

        if (!rows.length) {
            lines.push("Длины глав сходятся во всех общих книгах.");
        } else {
            lines.push(`Расхождений: **${rows.length}**, из них без правила: **${open}**.`);
            lines.push("");
            lines.push(`| книга | место | эталон (${reference.lang}) | ${edition.lang} | приведение |`);
            lines.push("|---|---|---:|---:|---|");
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
    for (const { code, lang, title } of EDITIONS) {
        const edition = await readEdition(db, code, lang, title);
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
