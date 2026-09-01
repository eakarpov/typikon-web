// Приёмка таблиц спряжения — тем же способом, что и склонение: порождаем парадигму
// и сверяем с формами, выписанными в словаре.
//
//   npx tsx src/scripts/verify-conjugation.ts          # сводка
//   npx tsx src/scripts/verify-conjugation.ts V21t     # с примерами расхождений
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { conjugate, type VerbSlot } from "@/lib/morphology/decline";

const ONLY = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const FOLD: Record<string, string> = { "ѧ": "я", "ꙗ": "я", "ѩ": "я", "ꙋ": "у", "ѹ": "у" };
const compare = (word: string) =>
    word.normalize("NFD").replace(/[̀-ͯ҃-҉]/g, "").toLowerCase()
        .replace(/ᲂу/g, "у").replace(/[ѧꙗѩꙋѹ]/g, (ch) => FOLD[ch]);

// Пометы словаря → строки книги. «indic,praes,sg,3p» → настоящее, ед., 3 лицо.
const slotOf = (tags: string[]): VerbSlot | null => {
    const has = (t: string) => tags.includes(t);
    const num = has("pl") ? "Pl" : has("du") ? "Du" : "Sg";
    const person = has("1p") ? "1" : has("2p") ? "2" : has("3p") ? "3" : "";

    if (has("inf")) return "inf";
    if (has("partcp")) {
        if (has("praet")) return has("pass") ? "partPastPass" : "partPastAct";
        if (has("perf")) return "partPerf";
        return has("pass") ? "partPresPass" : "partPresAct";
    }
    if (has("imper")) {
        if (num === "Pl") return person === "1" ? "impPl1" : "impPl2";
        if (num === "Du") return person === "1" ? "impDu1" : "impDu2";
        return "impSg23";
    }
    if (has("aor") || has("imperf")) {
        const mood = has("aor") ? "aor" : "imperf";
        if (num === "Sg") return `${mood}Sg${person === "1" ? "1" : "23"}` as VerbSlot;
        if (num === "Du") return `${mood}Du${person === "1" ? "1" : "23"}` as VerbSlot;
        return `${mood}Pl${person || "1"}` as VerbSlot;
    }
    if (has("praes") || has("fut")) {
        if (num === "Du") return person === "1" ? "presDu1" : "presDu23";
        return `pres${num}${person || "1"}` as VerbSlot;
    }
    return null;
};

async function main() {
    const client = await clientPromise;
    const lexems = await client.db("typikon-csl").collection("lexems")
        .find({ properties: /^V/ }).toArray();

    // Причастия в словаре выписаны склонёнными («а́лчущаго», «а́лчущему») — 37 550 форм
    // из 63 483. Склоняются они как прилагательные, и без таблиц A1* порождать их
    // нечем, поэтому личные формы и причастия считаются отдельно: иначе один
    // недостающий слой утопил бы оценку всего спряжения.
    const stats = new Map<string, { lexems: number; checked: number; hit: number; miss: string[] }>();
    const participles = { checked: 0, hit: 0 };
    let noParadigm = 0;

    for (const lexeme of lexems) {
        const scheme = String(lexeme.scheme ?? "");
        if (ONLY.length && !ONLY.includes(scheme)) continue;

        const table = conjugate(lexeme as any);
        if (!table) { noParadigm++; continue; }

        const row = stats.get(scheme) ?? { lexems: 0, checked: 0, hit: 0, miss: [] as string[] };
        row.lexems++;

        for (const form of (lexeme.forms ?? []) as { value?: string; properties?: string }[]) {
            const value = String(form.value ?? "");
            const properties = String(form.properties ?? "");
            if (!value || /[0-9]\^/.test(properties)) continue;

            const slots = properties.split("|")
                .map((analysis) => slotOf(analysis.split(",").flatMap((t) => t.split("/"))))
                .filter((slot): slot is VerbSlot => !!slot);
            if (!slots.length) continue;

            const produced = slots.flatMap((slot) => table[slot] ?? []);
            const matched = produced.some((generated) => compare(generated) === compare(value));

            if (/partcp/.test(properties)) {
                participles.checked++;
                if (matched) participles.hit++;
                continue;
            }

            row.checked++;
            if (matched) row.hit++;
            else if (row.miss.length < 6) {
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
        console.log(`${scheme.padEnd(7)} лексем ${String(row.lexems).padStart(5)}, форм ${String(row.checked).padStart(6)}, сходится ${String(row.hit).padStart(6)} (${share}%)`);
        if (ONLY.length) row.miss.forEach((m) => console.log(`         ${m}`));
    }

    console.log(`\nЛичные формы: ${hit} из ${checked} (${Math.round((hit / checked) * 100)}%)`);
    // Причастие склоняется прилагательным, и меряется оно там же: здесь считается
    // только попадание в исходную форму, а вся парадигма — в verify-adjectives.
    console.log(`Причастия, исходная форма: ${participles.hit} из ${participles.checked} `
        + `(${Math.round((participles.hit / participles.checked) * 100)}%); `
        + `склонение причастий — npx tsx src/scripts/verify-adjectives.ts`);
    console.log(`Лексем без парадигмы: ${noParadigm}`);
    process.exit(0);
}

main();
