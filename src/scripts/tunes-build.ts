// Сборка напевов из партитур по спецификации.
//
// ЗАЧЕМ. Ноты напева руками не переписываются: четыре голоса по восьми строкам —
// это сотни ячеек, и описка в одной из них не видна ни на стане, ни в раскладке.
// Руками пишется только то, чего из партитуры не вычесть, — СТРОЕНИЕ: где читок,
// где распев и к какому ударению он привязан. Содержание снимается скриптом.
//
// СПЕЦИФИКАЦИЯ — src/data/tunes/scores/<имя>.json:
//
//   { "music": "music", "target": "obihod-msk.json", "tunes": [ {
//       "id", "traditionId", "locality", "title", "select", "order", "sample",
//       "source",   — пойдёт в каждую запись
//       "file",     — партитура по умолчанию; с неё же берётся ключ
//       "lines": [ {
//           "label", "steps",
//           "file", "measure",   — ОБРАЗЦОВЫЙ ТАКТ этой строки
//           "map": [0, 0, 1, …], — на каждый слог такта номер шага; null — слог пропустить
//           "fill": { "4": ["партитура.xml", такт, слог] } — шаг, которого в образцовом
//                                                           такте нет, берётся из другого
//       } ]
//   } ] }
//
// Образцовый такт выбирается тот, где распев РАЗВЕДЁН по слогам: в другой стихире
// тот же распев бывает слит на одном ударном слоге, и шаги из него не вычесть.
// Номера слогов такта печатает tunes-shapes.ts.
//
// Содержание шага — ноты всех слогов, отнесённых к нему. У читка берётся только
// первый слог: повторы — забота раскладки. Долгая нота речитатива укорачивается
// до четверти: её длина в партитуре — длина текста, а не напева.
//
// Запуск:
//   npx tsx src/scripts/tunes-build.ts                    — все спецификации, запись в данные
//   npx tsx src/scripts/tunes-build.ts obihod-msk         — одна
//   npx tsx src/scripts/tunes-build.ts --check            — только сверить с данными
//
// При расхождениях в спецификации (карта не той длины, шаг без слога, голос без
// ноты) данные не пишутся вовсе: наполовину собранный напев хуже старого.
import fs from "fs";
import path from "path";
import { readScoreFile, type ScoreTable } from "@/scripts/lib/musicxml";
import type { LineOrder, Selector, Step, Tune, Voice } from "@/lib/tunes/types";

const SCORES_DIR = "src/data/tunes/scores";
const DATA_DIR = "src/data/tunes";

const VOICES: [string, Voice][] = [["S", "soprano"], ["A", "alt"], ["T", "tenor"], ["B", "bas"]];
const NOTE = /[_^=]*[A-Ga-g][,']*(\d+(?:\/\d+)?)?/g;

interface LineSpec {
    label?: string;
    steps: Step[];
    file?: string;
    measure: number;
    map: (number | null)[];
    fill?: Record<string, [string, number, number]>;
}

interface TuneSpec {
    id: string;
    traditionId: string;
    locality: string | null;
    title: string;
    select: Selector;
    order: LineOrder;
    sample?: Tune["sample"];
    source: string;
    file: string;
    lines: LineSpec[];
}

interface SpecFile {
    music: string;
    target: string;
    tunes: TuneSpec[];
}

/** Долгая нота речитатива — одна нота без длины; распев оставляем как есть. */
const reciting = (cell: string) => {
    const notes = cell.match(NOTE) ?? [];
    return notes.length === 1 ? notes[0].replace(/\d+(?:\/\d+)?$/, "") : cell;
};

const buildTune = (spec: TuneSpec, music: string, problems: string[]): Tune => {
    const cache = new Map<string, ScoreTable>();
    const table = (file: string) => {
        if (!cache.has(file)) cache.set(file, readScoreFile(path.join(music, file)));
        return cache.get(file)!;
    };
    const measure = (file: string, number: number) => {
        const found = table(file).measures.find(m => m.number === number);
        if (!found) throw new Error(`${spec.id}: в «${file}» нет такта ${number}`);
        return found;
    };

    const scores = Object.fromEntries(VOICES.map(([code]) => [code, [] as string[][]]));

    spec.lines.forEach((line, li) => {
        const where = `${spec.id}: строка ${li + 1}`;
        const file = line.file ?? spec.file;
        const syllables = measure(file, line.measure).syllables;
        if (line.map.length !== syllables.length) {
            problems.push(`${where}: в такте ${line.measure} «${file}» слогов ${syllables.length}, ` +
                `в карте ${line.map.length}: ${syllables.map(s => s.text).join(" ")}`);
        }

        for (const [code] of VOICES) {
            const cells = line.steps.map((step, k) => {
                const recite = step.flex && !step.stress;
                const borrowed = line.fill?.[String(k)];
                if (borrowed) {
                    const [from, number, at] = borrowed;
                    const cell = measure(from, number).syllables[at]?.voices[code] ?? "";
                    return recite ? reciting(cell) : cell;
                }
                const own = line.map.flatMap((to, i) => (to === k ? [i] : []));
                if (!own.length) {
                    if (code === "S") problems.push(`${where}, шаг ${k + 1}: нет слога в такте ${line.measure}`);
                    return "";
                }
                if (step.flex) return recite ? reciting(syllables[own[0]].voices[code]) : syllables[own[0]].voices[code];
                return own.map(i => syllables[i].voices[code]).join("");
            });
            cells.forEach((cell, k) => {
                // Пусто бывает, когда голос держит ноту с прошлого слога: нового
                // звука на этих слогах он не начинает. Такой такт в образцы не годится.
                if (!cell && line.map.includes(k)) {
                    problems.push(`${where}, шаг ${k + 1}: голос ${code} на нём не начинает ноты — возьмите другой такт`);
                }
            });
            scores[code].push(cells);
        }
    });

    const key = table(spec.file).key;
    return {
        id: spec.id,
        traditionId: spec.traditionId,
        locality: spec.locality ?? null,
        title: spec.title,
        select: spec.select,
        lines: spec.lines.map(line => (line.label === undefined ? { steps: line.steps } : { label: line.label, steps: line.steps })),
        order: spec.order,
        ...(spec.sample ? { sample: spec.sample } : {}),
        scores: VOICES.map(([code, voice]) => ({
            notation: "staff" as const, voice, key, source: spec.source, lines: scores[code],
        })),
    };
};

const main = () => {
    const args = process.argv.slice(2);
    const check = args.includes("--check");
    const names = args.filter(a => !a.startsWith("--"));
    const files = (names.length ? names.map(n => `${n.replace(/\.json$/, "")}.json`) : fs.readdirSync(SCORES_DIR))
        .filter(f => f.endsWith(".json"));

    let failed = false;
    for (const name of files) {
        const spec: SpecFile = JSON.parse(fs.readFileSync(path.join(SCORES_DIR, name), "utf8"));
        const problems: string[] = [];
        const built = spec.tunes.map(t => buildTune(t, spec.music, problems));
        if (problems.length) {
            console.error(`${name}: расхождения, данные не тронуты:\n  ` + problems.join("\n  "));
            failed = true;
            continue;
        }

        const target = path.join(DATA_DIR, spec.target);
        const raw = fs.readFileSync(target, "utf8");
        const data = JSON.parse(raw) as { tunes: Tune[] };
        const byId = new Map(built.map(t => [t.id, t]));
        const changed = built.filter(t => JSON.stringify(data.tunes.find(o => o.id === t.id)) !== JSON.stringify(t));
        data.tunes = data.tunes.map(t => byId.get(t.id) ?? t);
        for (const t of built) if (!data.tunes.some(o => o.id === t.id)) data.tunes.push(t);
        const out = JSON.stringify(data, null, 4) + "\n";

        if (check) {
            if (out !== raw) {
                console.error(`${name}: данные расходятся со спецификацией: ${changed.map(t => t.id).join(", ") || "порядок или формат"}`);
                failed = true;
            } else {
                console.log(`${name}: ${built.length} напевов, данные совпадают`);
            }
        } else {
            fs.writeFileSync(target, out);
            console.log(`${name} → ${target}: ${built.length} напевов, изменено ${changed.length}` +
                (changed.length ? `: ${changed.map(t => t.id).join(", ")}` : ""));
        }
    }
    if (failed) process.exit(1);
};

main();
