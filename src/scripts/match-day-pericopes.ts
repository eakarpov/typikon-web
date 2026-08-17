// Сухой прогон: сопоставляет occasions зачал Евангелия/Апостола с реальными
// днями (`days`), НИЧЕГО не пишет в базу — только печатает отчёт для проверки.
// Логика сопоставления вынесена в src/scripts/lib/pericope-matcher.ts — её же
// использует write-day-pericopes.ts, чтобы отчёт и реальная запись не расходились.
//
// Известные, осознанно оставленные неразрешёнными случаи (не по неделе/будню, а
// фрагмент конкретной службы — вне модели type+value+weekIndex):
//   - "Рим. 88Б" :: "На третьем часе Великой пятницы" — час, не Литургия.
//   - "1Кор. 143А" :: "пятницу" — голое слово без привязки к неделе, недостаточно контекста.
// "Утреня/литургия Рождества Христова" (Мф.2/3) — утреню сознательно не резолвим
// (см. историю чата), а "литургия" резолвится через именованный праздник.
//
// Запуск: npx tsx src/scripts/match-day-pericopes.ts > /tmp/pericope-match-report.txt
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { buildIndexes, classifySegment, splitOccasion } from "@/scripts/lib/pericope-matcher";

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");
    const idx = await buildIndexes(db);

    const stats = {
        totalSegments: 0, matchedFixed: 0, matchedMovable: 0,
        skippedRite: 0, skippedNonLiturgy: 0, unresolved: 0,
    };
    const unresolvedSamples: string[] = [];
    const matchedSamples: string[] = [];

    for (const source of ["gospel", "apostle"] as const) {
        const pericopes = await db.collection("pericopes").find({ source }).toArray();
        for (const p of pericopes) {
            for (const occasion of (p.occasions || [])) {
                for (const segment of splitOccasion(occasion)) {
                    stats.totalSegments++;
                    const result = classifySegment(segment, idx);

                    if (result.kind === "rite") { stats.skippedRite++; continue; }
                    if (result.kind === "nonLiturgy") { stats.skippedNonLiturgy++; continue; }
                    if (result.kind === "unresolved") {
                        stats.unresolved++;
                        if (unresolvedSamples.length < 400) unresolvedSamples.push(`"${p.label}" :: "${segment}"`);
                        continue;
                    }

                    if (result.via === "fixed" || result.via === "named-feast") stats.matchedFixed++;
                    else stats.matchedMovable++;
                    if (matchedSamples.length < 60) {
                        matchedSamples.push(`[${result.via}] "${p.label}" :: "${segment}" -> ${result.matches.map(m => m.dayName).join(" | ")}`);
                    }
                }
            }
        }
    }

    console.log("=== СТАТИСТИКА ===");
    console.log(JSON.stringify(stats, null, 2));
    console.log("\n=== ПРИМЕРЫ СОВПАДЕНИЙ (первые 60) ===");
    matchedSamples.forEach(s => console.log(s));
    console.log("\n=== НЕРАЗРЕШЁННЫЕ (первые 400) ===");
    unresolvedSamples.forEach(s => console.log(s));
};

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
