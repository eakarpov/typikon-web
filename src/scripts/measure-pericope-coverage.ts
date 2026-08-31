// Сколько чтений года каждое издание может отдать на самом деле.
//
// ЗАЧЕМ ОТДЕЛЬНЫМ ПРОГОНОМ, А НЕ НА СТРАНИЦЕ. Считается настоящей резолюцией —
// той же, что собирает чтение читателю, — а это 1067 зачал на каждый язык. По
// составу книг такое не прикинуть: издание может знать книгу и не знать половины
// отрезка (румынский Даниил отдавал 33 стиха вместо 88), и по составу это
// выглядело бы полным покрытием. Поэтому меряем по-настоящему и кладём число на
// издание; страница потом читает готовое.
//
// МЕРЯЕТСЯ ПО ЯЗЫКУ, а не по изданию напрямую: чтение читателю выбирается по
// языку (`editionForLang`), и покрытие должно отвечать на тот же вопрос, что
// задаёт читатель, — «что я получу, выбрав китайский».
//
// В БАЗУ ПИШЕТ ТОЛЬКО С --apply.
//
// Запуск:
//   npx tsx src/scripts/measure-pericope-coverage.ts
//   npx tsx src/scripts/measure-pericope-coverage.ts --apply
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { BIBLE_CANON } from "@/utils/bibleCanon";
import { BIBLE_EDITIONS } from "@/lib/bible/schema";
import { editionForLang } from "@/lib/bible/query";
import { resolvePericopeVerses } from "@/lib/pericopes";
import { coverageNote, coveragePercent } from "@/utils/bibleCoverage";

const APPLY = process.argv.includes("--apply");

const SECTION_OF = new Map(BIBLE_CANON.map((book) => [book.id, book.section]));
/** Раздел чтения: устав спрашивает Евангелие, Апостол и паремии — так и делим. */
const partOf = (canonId: string): "gospel" | "apostle" | "ot" => {
    const section = SECTION_OF.get(canonId);
    if (section === "gospel") return "gospel";
    if (section === "apostle" || section === "revelation") return "apostle";
    return "ot";
};

const main = async () => {
    const db = (await clientPromise).db("typikon");
    const pericopes = await db.collection("pericopes").find({}).toArray();
    const editions = await db.collection(BIBLE_EDITIONS).find({}).sort({ order: 1 }).toArray();
    const langs = [...new Set(editions.map((e) => e.langCode as string))];

    console.log(`зачал: ${pericopes.length}\n`);

    for (const lang of langs) {
        const edition = await editionForLang(db, lang);
        if (!edition) { console.log(`${lang}: издания нет — пропускаю`); continue; }

        const parts: Record<string, { total: number; served: number }> = {
            gospel: { total: 0, served: 0 },
            apostle: { total: 0, served: 0 },
            ot: { total: 0, served: 0 },
        };
        let served = 0;

        for (const pericope of pericopes) {
            const part = parts[partOf(pericope.bookSlug as string)];
            part.total += 1;
            const resolved = await resolvePericopeVerses(db, pericope, lang);
            if (resolved) { served += 1; part.served += 1; }
        }

        const coverage = {
            total: pericopes.length,
            served,
            parts,
            measuredAt: new Date(),
        };
        const note = coverageNote(coverage) ?? "отдаёт все чтения года";
        console.log(`${lang.padEnd(4)} ${String(edition.code).padEnd(14)} ` +
                    `${String(coveragePercent(coverage)).padStart(3)}%  ${note}`);

        if (APPLY) {
            await db.collection(BIBLE_EDITIONS)
                .updateOne({ _id: edition._id }, { $set: { coverage } });
        }
    }

    console.log(APPLY ? "\nзаписано в издания" : "\nПЛАН: без --apply в базу ничего не записано");
    process.exit(0);
};

main();
