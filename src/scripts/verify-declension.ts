// Приёмка таблиц склонения: порождаем парадигму и сверяем с формами словаря.
//
// Словарь (typikon-csl.lexems.forms) выписывает формы выборочно — неправильности,
// дублеты, беглый гласный. Каждая такая форма и есть тест: где словарь её называет,
// таблица обязана дать ту же.
//
// Ударение не сверяем: таблицы его не двигают вовсе (основа берётся из леммы как есть).
// Графику приводим к записи словаря — он набран без ѧ, ꙗ, ꙋ (я ×44083, ѧ ×0), а
// порождение выдаёт правильную церковнославянскую. Прочая графика сверяется строго:
// «ѡ» против «о» в дат. мн. — различие смысловое, им набор снимает омонимию с тв. ед.
//
//   npx tsx src/scripts/verify-declension.ts            # сводка по всем схемам
//   npx tsx src/scripts/verify-declension.ts N1k        # с примерами расхождений
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { decline, type Slot } from "@/lib/morphology/decline";
import { PARADIGMS } from "@/lib/morphology/paradigms";

const ONLY = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const FOLD: Record<string, string> = { "ѧ": "я", "ꙗ": "я", "ѩ": "я", "ꙋ": "у", "ѹ": "у" };

const compare = (word: string) =>
    word.normalize("NFD").replace(/[̀-ͯ҃-҉]/g, "").toLowerCase()
        .replace(/ᲂу/g, "у")
        .replace(/[ѧꙗѩꙋѹ]/g, (ch) => FOLD[ch]);

const CASES = ["nom", "gen", "acc", "dat", "ins", "loc", "voc"];
const NUMBERS = ["sg", "du", "pl"];

// Куда падает форма словаря в шестнадцати строках книги.
const SLOT_OF: Record<string, Slot> = {
    "sg.nom": "sgNom", "sg.acc": "sgAcc", "sg.gen": "sgGen", "sg.dat": "sgDat",
    "sg.loc": "sgLoc", "sg.ins": "sgIns", "sg.voc": "sgVoc",
    "pl.nom": "plNom", "pl.voc": "plNom", "pl.acc": "plAcc", "pl.gen": "plGen",
    "pl.dat": "plDat", "pl.loc": "plLoc", "pl.ins": "plIns",
    "du.nom": "duNomAcc", "du.acc": "duNomAcc", "du.voc": "duNomAcc",
    "du.gen": "duGenLoc", "du.loc": "duGenLoc", "du.dat": "duDatIns", "du.ins": "duDatIns",
};

const analyses = (properties: string) =>
    properties.split("|").map((analysis) => {
        const tags = analysis.split(",").filter(Boolean);
        return {
            number: NUMBERS.find((n) => tags.includes(n)),
            cases: tags.flatMap((tag) => tag.split("/")).filter((tag) => CASES.includes(tag)),
        };
    });

async function main() {
    const client = await clientPromise;
    const lexems = await client.db("typikon-csl").collection("lexems")
        .find({ properties: /^S/ }).toArray();

    const stats = new Map<string, { lexems: number; checked: number; hit: number; miss: string[] }>();
    let noParadigm = 0;

    for (const lexeme of lexems) {
        const scheme = String(lexeme.scheme ?? "");
        if (ONLY.length && !ONLY.includes(scheme)) continue;

        const table = decline(lexeme as any);
        if (!table) { noParadigm++; continue; }

        const row = stats.get(scheme) ?? { lexems: 0, checked: 0, hit: 0, miss: [] as string[] };
        row.lexems++;

        for (const form of (lexeme.forms ?? []) as { value?: string; properties?: string }[]) {
            const value = String(form.value ?? "");
            const properties = String(form.properties ?? "");
            if (!value) continue;
            // Сокращения под титлом таблица порождать и не должна.
            if (/[0-9]\^/.test(properties)) continue;

            const wanted = properties ? analyses(properties) : [{ number: "sg", cases: ["nom"] }];
            const slots = wanted.flatMap(({ number, cases }) =>
                number ? cases.map((kase) => SLOT_OF[`${number}.${kase}`]).filter(Boolean) : []);
            if (!slots.length) continue;

            row.checked++;
            const produced = slots.flatMap((slot) => table[slot] ?? []);

            if (produced.some((generated) => compare(generated) === compare(value))) row.hit++;
            else if (row.miss.length < 5) {
                row.miss.push(`${lexeme.name} → ${value} (${properties}); порождено: ${produced.join(" / ") || "—"}`);
            }
        }

        stats.set(scheme, row);
    }

    let checked = 0;
    let hit = 0;

    for (const [scheme, row] of [...stats].sort((a, b) => b[1].checked - a[1].checked)) {
        checked += row.checked;
        hit += row.hit;
        const share = row.checked ? Math.round((row.hit / row.checked) * 100) : 0;
        console.log(`${scheme.padEnd(6)} лексем ${String(row.lexems).padStart(5)}, форм ${String(row.checked).padStart(5)}, сходится ${String(row.hit).padStart(5)} (${share}%)`);
        if (ONLY.length) row.miss.forEach((m) => console.log(`         ${m}`));
    }

    const unknown = [...stats.keys()].filter((scheme) => !PARADIGMS[scheme]);
    console.log(`\nИтого: ${hit} из ${checked} (${Math.round((hit / checked) * 100)}%)`);
    console.log(`Лексем без парадигмы: ${noParadigm}${unknown.length ? `, схемы: ${unknown.join(", ")}` : ""}`);

    process.exit(0);
}

main();
