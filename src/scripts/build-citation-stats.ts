import "@/scripts/lib/env";
import { statSync } from "fs";
import Database from "better-sqlite3";
import clientPromise from "@/lib/mongodb";
import { CacheTag } from "@/lib/cache";
import { revalidateTags } from "@/scripts/lib/revalidate";
import { canonBook, BIBLE_CANON } from "@/utils/bibleCanon";
import { referenceChapterLengths } from "@/utils/bibleVersification";
import {
    isReading,
    READING_UNITS,
    silentRuns,
    type BookStats,
    type ChapterMap,
    type CitationSummary,
    type CorpusStamp,
    type TopStats,
    type TopVerse,
    type VerseCounts,
} from "@/lib/otzvuki/core";
import { STATS_COLLECTION, SUMMARY_ID, TOP_ID } from "@/lib/otzvuki/store";

// Свод цитируемости: пересчёт по корпусу в Монгу.
//
// ПОЧЕМУ СКРИПТОМ, А НЕ В РЕНДЕРЕ. Группировка 531 263 цитат по книгам читает
// таблицу целиком — 5,7 с, индексом это не лечится. Остальные разделы корпуса
// читают SQLite прямо в рендере, и правильно делают: там выборка — страница
// выдачи. Здесь выборка — вся таблица, и место ей в скрипте.
//
// ЗАПУСКАТЬ СРАЗУ ПОСЛЕ rules-db-release.sh. Тот кладёт новый файл корпуса и
// перезапускает службу; свод, посчитанный до этого, описывает уже не тот
// корпус. Чтобы расхождение было видно, а не подразумевалось, в сводку кладём
// отпечаток файла — размер и время правки, — и страница сравнивает его с тем,
// что лежит на сервере.
//
// Ничего не пишет без --write.
//
// Запуск:  npm run citations:stats [-- --write] [-- --show 20]

/** Строка выборки «стих × род строки»: классификацию делает TypeScript. */
interface UnitRow {
    canon_id: string;
    canon_sort: number;
    content_unit: string;
    n: number;
    sample: number;
}

/** Строка верхушки: адрес, число цитат, число памятей, образец. */
interface TopRow {
    canon_ref: string;
    n: number;
    memories: number;
    sample: number;
}

interface BookTotals {
    certain: number;
    candidate: number;
    chants: number;
}

const decode = (canonSort: number) => ({
    chapter: Math.floor(canonSort / 100000),
    verse: canonSort % 100000,
});

const main = async () => {
    const argv = process.argv;
    const write = argv.includes("--write");
    const show = Number(argv[argv.indexOf("--show") + 1]) || 15;

    const file = process.env.RULES_DB;
    if (!file) { console.error("нет RULES_DB в окружении"); process.exit(1); }
    const rules = new Database(file, { readonly: true, fileMustExist: true });

    const hasLayer = rules.prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'scripture_citations'",
    ).get();
    if (!hasLayer) {
        console.error(`в корпусе ${file} нет слоя цитат: пересчитывать нечего`);
        process.exit(1);
    }

    // Отпечаток корпуса: три счётчика, которые едут внутри файла. Время правки
    // и размер не годятся — выкладка возит базу архивом, и `unzip` время
    // округляет; счётчики же сдвигаются с каждой пересборкой.
    const stampRow = rules.prepare(`
        SELECT (SELECT max(item_id) FROM content_items) AS items,
               (SELECT max(group_id) FROM groups) AS groups,
               (SELECT max(rowid) FROM scripture_citations) AS citations
    `).get() as { items: number; groups: number; citations: number };
    const stamp: CorpusStamp = {
        items: stampRow.items ?? 0,
        groups: stampRow.groups ?? 0,
        citations: stampRow.citations ?? 0,
    };
    const bytes = statSync(file).size;

    // Стих и род строки — вместе, чтобы список чтений жил в одном месте
    // (@/lib/otzvuki/core), а не был переписан ещё и в SQL. Строк выходит
    // порядка тридцати тысяч: сгруппировать их в памяти дешевле, чем держать
    // два разных ответа на вопрос, что считать чтением.
    const unitRows = rules.prepare(`
        SELECT x.canon_id, x.canon_sort, ci.content_unit,
               count(*) AS n, min(x.item_id) AS sample
        FROM scripture_citations x
        JOIN content_items ci ON ci.item_id = x.item_id
        WHERE x.confidence = 'certain'
        GROUP BY x.canon_id, x.canon_sort, ci.content_unit
    `).all() as UnitRow[];

    // Итоги по книге считаем отдельным проходом: здесь нужны и кандидаты,
    // которых в карту мы не пускаем, но о числе которых умалчивать нечестно.
    const totalRows = rules.prepare(`
        SELECT canon_id, confidence, count(*) AS n,
               count(DISTINCT item_id) AS items
        FROM scripture_citations
        GROUP BY canon_id, confidence
    `).all() as Array<{ canon_id: string; confidence: string; n: number; items: number }>;

    const withCandidates = (rules.prepare(`
        SELECT count(*) AS n FROM (
            SELECT DISTINCT canon_id, canon_sort FROM scripture_citations
        )
    `).get() as { n: number }).n;

    const allChants = (rules.prepare(`
        SELECT count(DISTINCT item_id) AS n FROM scripture_citations WHERE confidence = 'certain'
    `).get() as { n: number }).n;

    // Верхушку считаем своим запросом, а не из карты, ради второго числа: в
    // скольких РАЗНЫХ памятях стих звучит. Без него «Дан. 3:57 — 1 349 раз»
    // читается двояко (поётся всякой службе или напечатано подряд в одной
    // книге), а с ним ответ однозначен. Список родов подставляется значениями
    // из READING_UNITS: единственный источник правды остаётся один.
    const marks = READING_UNITS.map(() => "?").join(", ");
    const topQuery = (side: "read" | "sung") => rules.prepare(`
        SELECT x.canon_ref,
               count(*) AS n,
               count(DISTINCT COALESCE(g.memory_id, c.memory_id, a.memory_id)) AS memories,
               min(x.item_id) AS sample
        FROM scripture_citations x
        JOIN content_items ci ON ci.item_id = x.item_id
        LEFT JOIN groups g ON g.group_id = ci.group_id
        LEFT JOIN canons c ON c.canon_id = ci.canon_id
        LEFT JOIN akathists a ON a.akathist_id = ci.akathist_id
        WHERE x.confidence = 'certain'
          AND ci.content_unit ${side === "read" ? "IN" : "NOT IN"} (${marks})
        GROUP BY x.canon_ref
        ORDER BY n DESC
        LIMIT 50
    `).all(...READING_UNITS) as TopRow[];

    const topRows = { sung: topQuery("sung"), read: topQuery("read") };

    rules.close();

    // Стих -> сколько раз поётся и сколько читается.
    const perVerse = new Map<string, Map<number, VerseCounts>>();

    for (const row of unitRows) {
        const reading = isReading(row.content_unit);
        const byVerse = perVerse.get(row.canon_id) ?? new Map<number, VerseCounts>();
        const { chapter, verse } = decode(row.canon_sort);
        const key = chapter * 100000 + verse;
        const counts = byVerse.get(key) ?? { v: verse, sung: 0, read: 0 };
        if (reading) counts.read += row.n; else counts.sung += row.n;
        byVerse.set(key, counts);
        perVerse.set(row.canon_id, byVerse);
    }

    const totals = new Map<string, BookTotals>();
    for (const row of totalRows) {
        const entry = totals.get(row.canon_id) ?? { certain: 0, candidate: 0, chants: 0 };
        if (row.confidence === "certain") {
            entry.certain = row.n;
            entry.chants = row.items;
        } else {
            entry.candidate = row.n;
        }
        totals.set(row.canon_id, entry);
    }

    const canonIds = new Set([...totals.keys(), ...perVerse.keys()]);
    const books: BookStats[] = [];

    for (const canonId of canonIds) {
        const book = canonBook(canonId);
        const lengths = referenceChapterLengths(canonId);
        const byVerse = perVerse.get(canonId) ?? new Map<number, VerseCounts>();

        const byChapter = new Map<number, VerseCounts[]>();
        let sung = 0, read = 0, any = 0;
        for (const [key, counts] of byVerse) {
            const chapter = Math.floor(key / 100000);
            const list = byChapter.get(chapter) ?? [];
            list.push(counts);
            byChapter.set(chapter, list);
            if (counts.sung > 0) sung++;
            if (counts.read > 0) read++;
            any++;
        }

        const chapters: ChapterMap[] = [...byChapter.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([chapter, verses]) => ({
                chapter,
                verses: verses.sort((a, b) => a.v - b.v),
            }));

        const totalsOf = totals.get(canonId) ?? { certain: 0, candidate: 0, chants: 0 };

        // Адреса мимо справочной разбивки: корпус ссылается на стих, которого
        // елизаветинская Библия в этой главе не печатает. Это расхождение
        // версификаций, и молчать о нём нельзя — на нём ломается охват.
        const outsideReference = lengths
            ? [...byVerse.entries()]
                .map(([key, counts]) => ({ chapter: Math.floor(key / 100000), verse: counts.v }))
                .filter(({ chapter, verse }) => verse > (lengths[chapter - 1] ?? 0))
                .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
            : [];

        books.push({
            canonId,
            order: book?.order ?? null,
            section: book?.section ?? null,
            inCanon: !!book,
            citations: { certain: totalsOf.certain, candidate: totalsOf.candidate },
            chants: totalsOf.chants,
            verses: { sung, read, any },
            referenceVerses: lengths ? lengths.reduce((a, b) => a + b, 0) : null,
            chapters,
            silent: silentRuns(chapters, lengths),
            outsideReference,
        });
    }

    books.sort((a, b) => (a.order ?? 1e6) - (b.order ?? 1e6) || a.canonId.localeCompare(b.canonId));

    // Топ стихов — только уверенные и только по своему счёту: чтение и
    // отзвук в одном списке дали бы верхушку из паремий, читаемых всякому
    // святому, и сказали бы о богослужении не то, о чём спрашивают.
    const top = (rows: TopRow[]): TopVerse[] => rows.flatMap((row) => {
        const parts = row.canon_ref.split(".");
        const verse = Number(parts.pop());
        const chapter = Number(parts.pop());
        const canonId = parts.join(".");
        if (!canonId || !Number.isInteger(chapter) || !Number.isInteger(verse)) return [];
        return [{
            canonRef: row.canon_ref,
            canonId,
            chapter,
            verse,
            count: row.n,
            memories: row.memories,
            sampleItemId: row.sample ?? null,
        }];
    });

    const topStats: TopStats = { sung: top(topRows.sung), read: top(topRows.read) };

    const canonVerses = BIBLE_CANON.reduce((sum, book) => {
        const lengths = referenceChapterLengths(book.id);
        return sum + (lengths ? lengths.reduce((a, b) => a + b, 0) : 0);
    }, 0);

    const sum = (pick: (b: BookStats) => number) => books.reduce((a, b) => a + pick(b), 0);

    const summary: CitationSummary = {
        citations: { certain: sum(b => b.citations.certain), candidate: sum(b => b.citations.candidate) },
        chants: allChants,
        verses: {
            sung: sum(b => b.verses.sung),
            read: sum(b => b.verses.read),
            any: sum(b => b.verses.any),
            withCandidates,
        },
        canonVerses,
        booksInCanon: books.filter(b => b.inCanon).length,
        booksOutside: books.filter(b => !b.inCanon).length,
        outsideReference: sum(b => b.outsideReference.length),
        generatedAt: new Date().toISOString(),
        stamp,
    };

    const n = (value: number) => value.toLocaleString("ru-RU");

    console.log(`корпус: ${file} (${n(bytes)} байт; отпечаток ${stamp.items}/${stamp.groups}/${stamp.citations})`);
    console.log(`цитат: ${n(summary.citations.certain)} уверенных, ${n(summary.citations.candidate)} кандидатов`);
    console.log(`стихов затронуто уверенно: ${n(summary.verses.any)} из ${n(canonVerses)}` +
        ` — поётся ${n(summary.verses.sung)}, читается ${n(summary.verses.read)}`);
    console.log(`с кандидатами вышло бы: ${n(withCandidates)}`);
    console.log(`книг: ${summary.booksInCanon} в каноне, ${summary.booksOutside} вне его`);
    console.log(`адресов мимо справочной разбивки: ${n(summary.outsideReference)}\n`);

    for (const book of books.slice(0, show)) {
        const coverage = book.referenceVerses
            ? `${Math.round((book.verses.any / book.referenceVerses) * 100)}%`
            : "—";
        const silent = book.referenceVerses ? book.referenceVerses - book.verses.any : null;
        console.log(`  ${book.canonId.padEnd(24)} поётся ${String(book.verses.sung).padStart(5)}` +
            `  читается ${String(book.verses.read).padStart(5)}  охват ${coverage.padStart(4)}` +
            `  молчит ${silent === null ? "—" : n(silent)}`);
    }
    if (books.length > show) console.log(`  … и ещё ${books.length - show} книг`);

    const line = (v: TopVerse) => `${v.canonRef} (${v.count} в ${v.memories} памятях)`;
    console.log(`\nчаще всего поётся: ${topStats.sung.slice(0, 4).map(line).join(", ")}`);
    console.log(`чаще всего читается: ${topStats.read.slice(0, 4).map(line).join(", ")}`);

    if (!write) {
        console.log("\nпробный прогон; чтобы записать — --write");
        return;
    }

    const db = (await clientPromise).db("typikon");
    const target = db.collection(STATS_COLLECTION);

    await target.updateOne({ _id: SUMMARY_ID as never }, { $set: summary }, { upsert: true });
    await target.updateOne({ _id: TOP_ID as never }, { $set: topStats }, { upsert: true });
    for (const book of books) {
        await target.updateOne({ _id: book.canonId as never }, { $set: book }, { upsert: true });
    }

    // Книга, о которой в корпусе не осталось ни одной цитаты, уходит из свода:
    // иначе она держалась бы в нём прошлой сборкой и врала про сегодняшнюю.
    const keep = [SUMMARY_ID, TOP_ID, ...books.map(b => b.canonId)];
    const gone = await target.deleteMany({ _id: { $nin: keep } as never });

    console.log(`\nзаписано книг: ${books.length}; удалено выпавших: ${gone.deletedCount}`);
    await revalidateTags([CacheTag.CITATIONS]);
};

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
