// Приёмка таблиц прилагательного — и заодно причастия, которое склоняется тем же.
//
//   npx tsx src/scripts/verify-adjectives.ts          # сводка
//   npx tsx src/scripts/verify-adjectives.ts A1k      # с примерами расхождений
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { declineAdjective, declineParticiple, type AdjSlot } from "@/lib/morphology/decline";

const ONLY = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const FOLD: Record<string, string> = { "ѧ": "я", "ꙗ": "я", "ѩ": "я", "ꙋ": "у", "ѹ": "у" };
const compare = (word: string) =>
    word.normalize("NFD").replace(/[̀-ͯ҃-҉]/g, "").toLowerCase()
        .replace(/ᲂу/g, "у").replace(/[ѧꙗѩꙋѹ]/g, (ch) => FOLD[ch]);

// Та же сверка, но слепая к графике: ѡ против о, ѣ против е, і против и. Нужна,
// чтобы отделить ошибку парадигмы от разнописи — их лечат разным.
const loosely = (word: string) =>
    compare(word).replace(/[ѡѻ]/g, "о").replace(/ѣ/g, "е").replace(/[іїѵ]/g, "и")
        .replace(/є/g, "е").replace(/ѕ/g, "з").replace(/ѳ/g, "ф");

// Пометы словаря → ячейки книги. Помета несёт род, число и падеж; ячейка их сводит
// («ед.м./ср.род.»), поэтому одна помета может указывать в одну ячейку, а «plen/brev»
// — в обе парадигмы разом.
const slotsOf = (tags: string[]): AdjSlot[] => {
    const has = (t: string) => tags.includes(t);
    const num = has("pl") ? "pl" : has("du") ? "du" : "sg";
    const masc = has("m");
    const neut = has("n");
    const fem = has("f");
    const out: AdjSlot[] = [];

    const add = (slot: AdjSlot) => { if (!out.includes(slot)) out.push(slot); };

    if (num === "sg") {
        if (has("nom") && masc) add("sgMNomAcc");
        if (has("acc") && masc) { add("sgMAcc"); add("sgMNomAcc"); }
        if ((has("nom") || has("acc")) && neut) add("sgNNomAcc");
        if (has("gen") && (masc || neut)) add("sgMNGen");
        if (has("dat") && (masc || neut)) add("sgMNDat");
        if (has("loc") && (masc || neut)) add("sgMNLoc");
        if (has("ins") && (masc || neut)) add("sgMNIns");
        if (has("nom") && fem) add("sgFNom");
        if (has("acc") && fem) add("sgFAcc");
        if (has("gen") && fem) add("sgFGen");
        if ((has("dat") || has("loc")) && fem) add("sgFDatLoc");
        if (has("ins") && fem) add("sgFIns");
    } else if (num === "pl") {
        if (has("nom") && masc) add("plMNom");
        if (has("acc") && masc) add("plMAccFNomAcc");
        if ((has("nom") || has("acc")) && fem) add("plMAccFNomAcc");
        if ((has("nom") || has("acc")) && neut) add("plNNomAcc");
        if (has("gen") || has("loc")) add("plGenLoc");
        if (has("dat")) add("plDat");
        if (has("ins")) add("plIns");
    } else {
        if ((has("nom") || has("acc")) && masc) add("duMNomAcc");
        if ((has("nom") || has("acc")) && (neut || fem)) add("duNFNomAcc");
        if (has("gen") || has("loc")) add("duGenLoc");
        if (has("dat") || has("ins")) add("duDatIns");
    }

    return out;
};

/** Основа причастия: отрезаем окончание исходной формы, оставляя «а҆́лчꙋщ-». */
const participleBase = (value: string) =>
    value.replace(/(ый|ій|ая|ое|ъ|ь|а|о|е|и|я)$/, "");

async function main() {
    const client = await clientPromise;
    const db = client.db("typikon-csl");

    // --- прилагательные ---
    const adjectives = await db.collection("lexems").find({ properties: /^(A|APRO|SPRO)/ }).toArray();
    const stats = new Map<string, { lexems: number; checked: number; hit: number; miss: string[] }>();
    let noParadigm = 0;
    let graphic = 0;

    for (const lexeme of adjectives) {
        const scheme = String(lexeme.scheme ?? "");
        if (ONLY.length && !ONLY.includes(scheme)) continue;

        const table = declineAdjective(lexeme as any);
        if (!table) { noParadigm++; continue; }

        const row = stats.get(scheme) ?? { lexems: 0, checked: 0, hit: 0, miss: [] as string[] };
        row.lexems++;

        for (const form of (lexeme.forms ?? []) as { value?: string; properties?: string }[]) {
            const value = String(form.value ?? "");
            const properties = String(form.properties ?? "");
            if (!value || /[0-9]\^/.test(properties)) continue;

            const produced: string[] = [];
            for (const analysis of properties.split("|")) {
                const tags = analysis.split(",").flatMap((t) => t.split("/"));
                const wantsPlen = tags.includes("plen") || !tags.includes("brev");
                const wantsBrev = tags.includes("brev") || !tags.includes("plen");
                for (const slot of slotsOf(tags)) {
                    if (wantsPlen) produced.push(...table.plen[slot]);
                    if (wantsBrev) produced.push(...table.brev[slot]);
                }
            }
            if (!produced.length && !properties) continue;

            row.checked++;
            if (produced.some((generated) => compare(generated) === compare(value))) row.hit++;
            else if (produced.some((generated) => loosely(generated) === loosely(value))) graphic++;
            else if (row.miss.length < 6) {
                row.miss.push(`${lexeme.name} → ${value} (${properties}); порождено: ${produced.slice(0, 4).join(" / ") || "—"}`);
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
    console.log(`\nПрилагательные: ${hit} из ${checked} (${Math.round((hit / checked) * 100)}%), `
        + `расходятся только графикой ещё ${graphic} (${Math.round(((hit + graphic) / checked) * 100)}% вместе), `
        + `без парадигмы ${noParadigm} лексем`);

    if (ONLY.length) { process.exit(0); }

    // --- причастия ---
    //
    // Основу берём из той формы словаря, что стоит в исходном виде, и склоняем её
    // прилагательным. Это и есть проверка: если основа снята верно, все остальные
    // формы причастия обязаны сойтись.
    const verbs = await db.collection("lexems").find({ properties: /^V/ }).toArray();
    let partChecked = 0;
    let partHit = 0;

    for (const lexeme of verbs) {
        const forms = (lexeme.forms ?? []) as { value?: string; properties?: string }[];
        const bases = new Set<string>();

        for (const form of forms) {
            const properties = String(form.properties ?? "");
            if (!/partcp/.test(properties) || /[0-9]\^/.test(properties)) continue;
            bases.add(participleBase(String(form.value ?? "")));
        }
        if (!bases.size) continue;

        const tables = [...bases].filter(Boolean).map(declineParticiple);

        for (const form of forms) {
            const value = String(form.value ?? "");
            const properties = String(form.properties ?? "");
            if (!value || !/partcp/.test(properties) || /[0-9]\^/.test(properties)) continue;

            const produced: string[] = [];
            for (const analysis of properties.split("|")) {
                const tags = analysis.split(",").flatMap((t) => t.split("/"));
                for (const table of tables) {
                    for (const slot of slotsOf(tags)) {
                        produced.push(...table.plen[slot], ...table.brev[slot]);
                    }
                }
            }
            if (!produced.length) continue;

            partChecked++;
            if (produced.some((generated) => compare(generated) === compare(value))) partHit++;
        }
    }

    console.log(`Причастия: ${partHit} из ${partChecked} (${Math.round((partHit / partChecked) * 100)}%)`);
    process.exit(0);
}

main();
