// Проверка напевов той же раскладкой, какой пользуется страница.
//
// Первое — образец (sample) каждого напева: какое колено какой строкой поётся,
// какой слог каким шагом, что не сошлось. Второе, по --corpus, — все тексты
// корпуса, которые этим напевом были бы спеты: сколько ложатся без замечаний,
// сколько расходятся только в слогах и сколько — в числе колен.
//
// Обозначения в образце: «~» — слог на читке, «+» — шаг тянется на лишний слог,
// «'» — ударный по разметке книги; после двоеточия ноты сопрано.
//
// Запуск:
//   npx tsx src/scripts/tunes-verify.ts                          — все напевы
//   npx tsx src/scripts/tunes-verify.ts obihod-msk/podoben       — по части ключа
//   NODE_ENV=development npx tsx src/scripts/tunes-verify.ts obihod-msk --corpus
import "@/scripts/lib/env";
import fs from "fs";
import Database from "better-sqlite3";
import { fitTune } from "@/lib/tunes/apply";
import { tuneLibrary } from "@/lib/tunes/registry";
import { podobenKey } from "@/lib/tunes/resolve";
import { hasColonMarkup, parseChantText } from "@/lib/tunes/syllables";
import type { Tune } from "@/lib/tunes/types";

const args = process.argv.slice(2);
const corpus = args.includes("--corpus");
const filters = args.filter(a => !a.startsWith("--"));

const library = tuneLibrary();
if (library.problems.length) console.log("РЕЕСТР:\n  " + library.problems.join("\n  "));
const tunes = library.tunes.filter(t => !filters.length || filters.some(f => t.id.includes(f)));

const showSample = (tune: Tune, text: string) => {
    const fitted = fitTune(tune, parseChantText(text));
    const soprano = tune.scores.find(s => s.voice === "soprano" || s.voice === "edinoglas");
    fitted.colons.forEach((colon, i) => {
        const cells = colon.cells.map(cell => {
            const notes = soprano ? cell.steps.map(s => soprano.lines[colon.line]?.[s] ?? "?").join("") : "";
            return `${cell.flex ? "~" : ""}${cell.held ? "+" : ""}${cell.syllable}${cell.stressed ? "'" : ""}:${notes}`;
        });
        const unused = colon.unused ? `, непропето ${colon.unused}` : "";
        console.log(`  ${String(i + 1).padStart(2)} [строка ${colon.line + 1}${unused}] ${cells.join("  ")}`);
    });
    console.log(fitted.issues.length ? "  ЗАМЕЧАНИЯ: " + fitted.issues.join("; ") : "  замечаний нет");
};

for (const tune of tunes) {
    console.log(`\n=== ${tune.id} — ${tune.title}`);
    if (tune.sample) showSample(tune, tune.sample.text);
    else console.log("  образца нет");
}

if (corpus) {
    const file = process.env.RULES_DB;
    if (!file || !fs.existsSync(file)) {
        console.error(`\nКорпус не найден (RULES_DB=${file ?? "не задан"}). Локально: NODE_ENV=development`);
        process.exit(1);
    }
    const rows = new Database(file, { readonly: true, fileMustExist: true }).prepare(`
        SELECT ci.text, ci.content_unit, g.podoben, COALESCE(g.tone, c.tone) AS tone
        FROM content_items ci
        LEFT JOIN groups g ON g.group_id = ci.group_id
        LEFT JOIN canons c ON c.canon_id = ci.canon_id
        WHERE ci.language = 'cu_gr' AND ci.text IS NOT NULL`).all() as
        { text: string; content_unit: string; podoben: string | null; tone: number | null }[];

    console.log("\n=== КОРПУС: тексты с размеченными коленами");
    for (const tune of tunes) {
        const sel = tune.select;
        const mine = rows.filter(r => sel.kind === "podoben"
            ? !!r.podoben && r.tone === sel.tone && podobenKey(r.podoben) === podobenKey(sel.podoben)
            : !r.podoben && r.tone === sel.tone && r.content_unit === sel.genre);
        const marked = mine.filter(r => hasColonMarkup(r.text));
        let clean = 0, syllablesOnly = 0, colonCount = 0;
        for (const r of marked) {
            const { issues } = fitTune(tune, parseChantText(r.text));
            if (!issues.length) clean++;
            else if (issues.some(i => /^в напеве \d+ строк|^колен \d+/.test(i))) colonCount++;
            else syllablesOnly++;
        }
        console.log(`${tune.id}: всего ${mine.length}, с коленами ${marked.length}; ` +
            `без замечаний ${clean}, только по слогам ${syllablesOnly}, по числу колен ${colonCount}`);
    }
}
