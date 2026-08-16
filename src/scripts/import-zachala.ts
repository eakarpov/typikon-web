// Импорт списков богослужебных зачал Евангелия и Апостола с azbyka.ru в коллекцию
// pericopes. Источники — табличные справочные страницы (номер, глава:стих, повод),
// не текст самих чтений: диапазоны стихов затем резолвятся в реальный текст через
// resolvePericopeVerses (см. src/lib/pericopes.ts) по уже импортированным Библиям.
//
// Запуск: npx tsx src/scripts/import-zachala.ts
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { findBookByCode, findBookSlugByAbbreviation } from "@/utils/texts";

const SOURCES: Array<{ source: "gospel" | "apostle"; url: string }> = [
    { source: "gospel", url: "https://azbyka.ru/shemy/spisok-vseh-bogosluzhebnyh-zachal-evangelija.shtml" },
    { source: "apostle", url: "https://azbyka.ru/shemy/spisok-vseh-bogosluzhebnyh-zachal-apostola.shtml" },
];

const USER_AGENT = "Mozilla/5.0 (compatible; typikon.su-importer/1.0; +https://typikon.su)";

interface IRange { chapterFrom: number; verseFrom: number; chapterTo: number; verseTo: number; }

const stripTags = (html: string): string =>
    html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// "1:1-25" | "4:25-5:12" | "1:12-17,21-26" | "10:1,5-8" | "9:42-10:1"
const parseChapterParam = (param: string): IRange[] => {
    const ranges: IRange[] = [];
    let currentChapter: number | null = null;

    param.split(",").map(s => s.trim()).forEach(seg => {
        let m: RegExpMatchArray | null;
        if ((m = seg.match(/^(\d+):(\d+)-(\d+):(\d+)$/))) {
            const chapterFrom = parseInt(m[1], 10), verseFrom = parseInt(m[2], 10);
            const chapterTo = parseInt(m[3], 10), verseTo = parseInt(m[4], 10);
            ranges.push({ chapterFrom, verseFrom, chapterTo, verseTo });
            currentChapter = chapterTo;
        } else if ((m = seg.match(/^(\d+):(\d+)-(\d+)$/))) {
            const chapter = parseInt(m[1], 10), verseFrom = parseInt(m[2], 10), verseTo = parseInt(m[3], 10);
            ranges.push({ chapterFrom: chapter, verseFrom, chapterTo: chapter, verseTo });
            currentChapter = chapter;
        } else if ((m = seg.match(/^(\d+):(\d+)$/))) {
            const chapter = parseInt(m[1], 10), verse = parseInt(m[2], 10);
            ranges.push({ chapterFrom: chapter, verseFrom: verse, chapterTo: chapter, verseTo: verse });
            currentChapter = chapter;
        } else if (currentChapter !== null && (m = seg.match(/^(\d+)-(\d+):(\d+)$/))) {
            // "35-6:1" при currentChapter=5 — это "5:35-6:1": начало без явной главы (унаследована),
            // конец с явной главой (переход через границу главы).
            const verseFrom = parseInt(m[1], 10), chapterTo = parseInt(m[2], 10), verseTo = parseInt(m[3], 10);
            ranges.push({ chapterFrom: currentChapter, verseFrom, chapterTo, verseTo });
            currentChapter = chapterTo;
        } else if (currentChapter !== null && (m = seg.match(/^(\d+)-(\d+)$/))) {
            const verseFrom = parseInt(m[1], 10), verseTo = parseInt(m[2], 10);
            ranges.push({ chapterFrom: currentChapter, verseFrom, chapterTo: currentChapter, verseTo });
        } else if (currentChapter !== null && (m = seg.match(/^(\d+)$/))) {
            const verse = parseInt(m[1], 10);
            ranges.push({ chapterFrom: currentChapter, verseFrom: verse, chapterTo: currentChapter, verseTo: verse });
        } else {
            console.warn(`  !! не удалось распарсить сегмент диапазона: "${seg}" (param="${param}")`);
        }
    });

    return ranges;
};

interface IParsedRow {
    bookSlug: string;
    abbreviation: string;
    number: number;
    variant: string | null;
    ranges: IRange[];
    occasions: string[];
}

const parseTableRows = (html: string, source: "gospel" | "apostle"): IParsedRow[] => {
    const rows: IParsedRow[] = [];
    const trMatches = html.matchAll(/<tr>([\s\S]*?)<\/tr>/g);

    for (const trMatch of trMatches) {
        const cells = [...trMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]);
        if (cells.length < 2) continue;

        const firstCellText = stripTags(cells[0]);
        const numberMatch = firstCellText.match(/зачало\s+(\d+)([^\d,;]*)$/i);
        if (!numberMatch) continue; // не строка данных (заголовок таблицы и т.п.)

        const number = parseInt(numberMatch[1], 10);
        const variant = numberMatch[2].trim() || null;

        const dataTitleMatches = [...cells[1].matchAll(/data-title='\?title=([A-Za-z0-9]+)&chapter=([^&']+)/g)];

        let bookInfo: { slug: string; abbreviation: string } | null = null;
        let ranges: IRange[] = [];

        if (dataTitleMatches.length > 0) {
            bookInfo = findBookByCode(dataTitleMatches[0][1]);
            ranges = dataTitleMatches.flatMap(m => parseChapterParam(decodeURIComponent(m[2])));
        } else {
            // Несколько строк на странице обходятся без data-title-разметки, просто
            // текстом вида "1Кор:1:26–29" или "Гал:4:23–31" — разбираем как fallback.
            const plain = stripTags(cells[1]).replace(/–/g, "-");
            const fallbackMatch = plain.match(/^([А-Яа-я0-9]+)[.:]+\s*(.+)$/);
            if (fallbackMatch) {
                const slug = findBookSlugByAbbreviation(fallbackMatch[1]);
                if (slug) {
                    bookInfo = { slug, abbreviation: fallbackMatch[1] };
                    ranges = parseChapterParam(fallbackMatch[2].replace(/^\./, "").trim());
                }
            }
        }

        if (!bookInfo) {
            console.warn(`  !! не удалось определить книгу в строке "${firstCellText}" (ячейка: "${stripTags(cells[1])}")`);
            continue;
        }
        if (ranges.length === 0) {
            console.warn(`  !! не удалось распарсить диапазон в строке "${firstCellText}" (ячейка: "${stripTags(cells[1])}")`);
            continue;
        }

        const occasions = cells.slice(2)
            .map(c => stripTags(c))
            .filter(Boolean);

        rows.push({
            bookSlug: bookInfo.slug,
            abbreviation: bookInfo.abbreviation,
            number,
            variant,
            ranges,
            occasions,
        });
    }

    return rows;
};

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");

    await db.collection("pericopes").deleteMany({}); // повторный запуск полностью пересобирает список
    let total = 0;

    for (const { source, url } of SOURCES) {
        const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
        if (!res.ok) throw new Error(`HTTP ${res.status} для ${url}`);
        const html = await res.text();

        const rows = parseTableRows(html, source);
        if (rows.length === 0) {
            throw new Error(`Не удалось распарсить ни одной строки для ${source} (${url}) — проверь разметку страницы`);
        }

        await db.collection("pericopes").insertMany(
            rows.map(r => ({
                source,
                bookSlug: r.bookSlug,
                number: r.number,
                variant: r.variant,
                label: `${r.abbreviation}. ${r.number}${r.variant || ""}`,
                occasions: r.occasions,
                ranges: r.ranges,
                updatedAt: new Date(),
            }))
        );

        console.log(`${source}: импортировано зачал — ${rows.length}`);
        total += rows.length;
    }

    console.log(`\nГотово: всего зачал — ${total}`);
};

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
