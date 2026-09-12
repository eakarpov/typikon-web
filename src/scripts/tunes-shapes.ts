// Формы тактов партитуры — то, по чему напев снимается руками.
//
// Для каждой партитуры находит в корпусе её текст (подтекстовка без ударений,
// корпус с ударениями), переносит ударения на слоги подтекстовки и печатает
// такт в одну строку: слог, его номер, ноты сопрано; ниже бас. По этим строкам
// сличаются стихиры одного подобна — какие такты несут одну строку напева, где
// читок, куда сел распев, — и по ним же пишется карта «слог → шаг» в
// спецификации (см. tunes-build.ts).
//
// Обозначения: «'» — ударный слог по корпусу; «~» — та же нота сопрано, что на
// предыдущем слоге (читок повтором); {…} — несколько слов под одной нотой (читок
// долгой нотой); число перед двоеточием — номер слога в такте, с нуля.
//
// Текст ищется по началу, без ударений и знаков, нечётко: в партитурах бывают
// описки и своя орфография («пренесение»). Партитура стиховны нередко начинается
// стихом («Смерть преподобных Его»), поэтому сличается и со второго такта.
// Не нашлось — укажите сами: --item "файл.xml=31346".
//
// Запуск (нужен корпус typikon-rules, путь — RULES_DB):
//   NODE_ENV=development npx tsx src/scripts/tunes-shapes.ts                 — все партитуры
//   NODE_ENV=development npx tsx src/scripts/tunes-shapes.ts "Яко добля"     — по части имени
//   … --dir music --item "Николай перенесение Яко добля — 1.xml=31346"
import "@/scripts/lib/env";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { parseChantText, splitWord } from "@/lib/tunes/syllables";
import { readScoreFile, type ScoreTable } from "@/scripts/lib/musicxml";

const args = process.argv.slice(2);
const option = (name: string) => {
    const out: string[] = [];
    args.forEach((a, i) => { if (a === name && args[i + 1]) out.push(args[i + 1]); });
    return out;
};
const DIR = option("--dir")[0] ?? "music";
const MANUAL = new Map(option("--item").map(pair => {
    const at = pair.lastIndexOf("=");
    return [pair.slice(0, at), Number(pair.slice(at + 1))] as const;
}));
const FILTERS = args.filter((a, i) => !a.startsWith("--") && !["--dir", "--item"].includes(args[i - 1]));

const FOLD: Record<string, string> = { "ѣ": "е", "і": "и", "ѵ": "и", "ѡ": "о", "ꙋ": "у", "ѳ": "ф" };

/** Одни буквы, без ударений и регистра, с дореформенными сведёнными к гражданским. */
const fold = (s: string) =>
    [...s.normalize("NFD").toLowerCase()].filter(ch => /\p{L}/u.test(ch)).map(ch => FOLD[ch] ?? ch).join("");

const similarity = (a: string, b: string) => {
    if (!a.length && !b.length) return 1;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        for (let j = 1; j <= b.length; j++) {
            row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = row;
    }
    return 1 - prev[b.length] / Math.max(a.length, b.length);
};

interface CorpusRow {
    item_id: number;
    text: string;
    tone: number | null;
    podoben: string | null;
    position_id: string | null;
    memory_id: string | null;
}

const openCorpus = (): CorpusRow[] => {
    const file = process.env.RULES_DB;
    if (!file || !fs.existsSync(file)) {
        console.error(`Корпус не найден (RULES_DB=${file ?? "не задан"}). Локально: NODE_ENV=development или RULES_DB=…/data.db`);
        process.exit(1);
    }
    const db = new Database(file, { readonly: true, fileMustExist: true });
    return db.prepare(`
        SELECT ci.item_id, ci.text, COALESCE(g.tone, c.tone) AS tone, g.podoben, g.position_id, g.memory_id
        FROM content_items ci
        LEFT JOIN groups g ON g.group_id = ci.group_id
        LEFT JOIN canons c ON c.canon_id = ci.canon_id
        WHERE ci.language = 'cu_gr' AND ci.text IS NOT NULL`).all() as CorpusRow[];
};

const KEY_LENGTH = 40;

const indexCorpus = (rows: CorpusRow[]) => {
    const by6 = new Map<string, { key: string; row: CorpusRow }[]>();
    const by3 = new Map<string, { key: string; row: CorpusRow }[]>();
    for (const row of rows) {
        const key = fold(row.text).slice(0, KEY_LENGTH);
        if (key.length < 20) continue;
        for (const [map, n] of [[by6, 6], [by3, 3]] as const) {
            const k = key.slice(0, n);
            if (!map.has(k)) map.set(k, []);
            map.get(k)!.push({ key, row });
        }
    }
    return { by6, by3 };
};

const measureText = (table: ScoreTable, from: number) =>
    table.measures.slice(from).flatMap(m => m.syllables)
        .map(s => s.text.replace(/-$/, "") + (s.syllabic === "begin" || s.syllabic === "middle" ? "" : " "))
        .join("");

const findText = (table: ScoreTable, index: ReturnType<typeof indexCorpus>) => {
    let best: { row: CorpusRow; ratio: number; from: number } | null = null;
    for (const from of [0, 1]) {
        const key = fold(measureText(table, from)).slice(0, KEY_LENGTH);
        const pool = index.by6.get(key.slice(0, 6)) ?? index.by3.get(key.slice(0, 3)) ?? [];
        for (const { key: other, row } of pool) {
            const ratio = similarity(key, other);
            if (ratio >= 0.6 && (!best || ratio > best.ratio)) best = { row, ratio, from };
        }
    }
    return best;
};

/** Место слога в партитуре: такт, слог, слово внутри подписи. */
interface LyricPart { measure: number; syllable: number; piece: number; text: string }

/** Слова подтекстовки: подпись под нотой бывает частью слова, а бывает несколькими словами. */
const lyricWords = (table: ScoreTable): LyricPart[][] => {
    const words: LyricPart[][] = [];
    let open: LyricPart[] | null = null;
    table.measures.forEach((m, mi) => m.syllables.forEach((s, si) => {
        const pieces = s.text.replace(/-$/, "").split(/\s+/).filter(Boolean);
        const continues = s.syllabic === "begin" || s.syllabic === "middle";
        pieces.forEach((text, pi) => {
            const part = { measure: mi, syllable: si, piece: pi, text };
            if (!open) open = [];
            open.push(part);
            const last = pi === pieces.length - 1;
            if (!last || !continues) { words.push(open); open = null; }
        });
    }));
    if (open) words.push(open);
    return words;
};

/** Слова корпусного текста с номером ударного слога (−1, если знака нет). */
const corpusWords = (text: string) => {
    const out: { text: string; stressed: number; syllables: number }[] = [];
    for (const colon of parseChantText(text)) {
        for (const syl of colon.syllables) {
            if (syl.wordStart || !out.length) out.push({ text: "", stressed: -1, syllables: 0 });
            const word = out[out.length - 1];
            if (syl.stressed && word.stressed < 0) word.stressed = word.syllables;
            word.text += syl.text;
            word.syllables++;
        }
    }
    return out;
};

/** Выравнивание двух рядов слов (наибольшая общая подпоследовательность с нечётким равенством). */
const align = (a: string[], b: string[]) => {
    const same = (x: string, y: string) => x === y || (Math.min(x.length, y.length) >= 4 && similarity(x, y) >= 0.75);
    const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            dp[i][j] = same(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }
    const pairs: [number, number][] = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
        if (same(a[i], b[j])) { pairs.push([i, j]); i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
        else j++;
    }
    return pairs;
};

const stressedParts = (table: ScoreTable, text: string) => {
    const lyric = lyricWords(table);
    const corpus = corpusWords(text);
    const marks = new Set<string>();
    for (const [li, ci] of align(lyric.map(w => fold(w.map(p => p.text).join(""))), corpus.map(w => fold(w.text)))) {
        const target = corpus[ci].stressed;
        if (target < 0) continue;
        let count = 0;
        for (const part of lyric[li]) {
            const n = Math.max(1, splitWord(part.text).length);
            if (target < count + n) { marks.add(`${part.measure}:${part.syllable}:${part.piece}`); break; }
            count += n;
        }
    }
    return marks;
};

const main = () => {
    const files = fs.readdirSync(DIR).filter(f => f.endsWith(".xml"))
        .filter(f => !FILTERS.length || FILTERS.some(q => f.includes(q)))
        .sort((a, b) => a.localeCompare(b, "ru"));
    if (!files.length) { console.error(`В «${DIR}» нет подходящих партитур`); process.exit(1); }

    const rows = openCorpus();
    const byItem = new Map(rows.map(r => [r.item_id, r]));
    const index = indexCorpus(rows);

    for (const file of files) {
        const table = readScoreFile(path.join(DIR, file));
        const manual = MANUAL.get(file);
        const found = manual !== undefined
            ? (byItem.has(manual) ? { row: byItem.get(manual)!, ratio: 1, from: 0 } : null)
            : findText(table, index);
        const marks = found ? stressedParts(table, found.row.text) : new Set<string>();

        const corpusNote = found
            ? `корпус ${found.row.item_id} (${found.row.memory_id}, ${found.row.position_id}, глас ${found.row.tone ?? "—"}` +
              `${found.row.podoben ? `, подобен «${found.row.podoben}»` : ""}; ${parseChantText(found.row.text).length} колен` +
              `${found.from ? "; сличено со второго такта" : ""})`
            : "корпус: не найден";
        console.log(`\n### ${file} | ${table.title} | ${table.creator.trim()} | ключ ${table.key} | ${corpusNote}`);

        table.measures.forEach((m, mi) => {
            const cells = m.syllables.map((s, si) => {
                const pieces = s.text.replace(/-$/, "").split(/\s+/).filter(Boolean)
                    .map((p, pi) => p + (marks.has(`${mi}:${si}:${pi}`) ? "'" : ""));
                const body = `${si}:${pieces.join(" ")}:${s.voices.S}`;
                const repeated = si > 0 && s.voices.S === m.syllables[si - 1].voices.S && s.sopranoMidi.length === 1;
                return pieces.length > 1 ? `{${body}}` : repeated ? `~${body}` : body;
            });
            console.log(` m${String(m.number).padStart(2)} (${m.syllables.length})  ${cells.join("  ")}`);
            console.log(`        B: ${m.syllables.map(s => s.voices.B ?? "").join(" ")}`);
        });
    }
};

main();
