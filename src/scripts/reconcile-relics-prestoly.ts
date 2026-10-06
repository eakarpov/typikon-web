// Сверка святынь и престолов: где реестр святынь расходится с престолами храмов.
//
// ЗАЧЕМ. Святыни и престолы заводятся порознь и по разным поводам: престол
// выводится из имени храма (@/utils/dedications), святыня приходит из новости
// прихода или «Азбуки паломника». Оба называют одного и того же святого, но
// ключа между собой не имеют — престол говорит посвящением, святыня номером
// святого каталога. Здесь они сводятся: посвящение храма — его престолы —
// святые каталога, и с этим списком сверяется святыня.
//
// ЧТО ЗНАЧИТ РАСХОЖДЕНИЕ. «Святыни такого святого нет в престолах храма» — не
// ошибка: частицу мощей приносят в храм, освящённый иначе, и ковчег стоит
// рядом с чужим престолом. Но это повод посмотреть: либо придел, которого имя
// не назвало (приделов у храма больше, чем слов в имени), либо святыня отнесена
// к чужому храму. Молчание здесь ничего не доказывает, а расхождение — вопрос.
//
// ДАТЫ. Храм, освящённый святому прежде его прославления, — заведомо чужой
// престол или переосвящение. Об этом и говорит третья часть отчёта: год храма
// (поле `year`, Wikidata) против года прославления посвящения (`canonized`).
// Проверка груба — год храма бывает годом постройки, а не освящения, и местное
// почитание старше прославления, — и потому это ОЧЕРЕДЬ НА ВЗГЛЯД, а не список
// ошибок.
//
// Ничего не пишет: отчёт. Запуск:  npm run relics:reconcile [-- --show 40]

import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";

const arg = (name: string, fallback?: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback;
};
const SHOW = Number(arg("show", "25")) || 25;

/** Первые N строк очереди — с оговоркой, сколько осталось. */
const show = (items: string[]) => {
    items.slice(0, SHOW).forEach((s) => console.log(`   ${s}`));
    if (items.length > SHOW) console.log(`   … ещё ${items.length - SHOW}`);
};

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");
    const users = client.db("typikon-users");
    const temples = db.collection("temples");
    const dedications = db.collection("dedications");

    // Святые посвящения: утверждённые связи и кандидаты — обе называют святого,
    // и для сверки годится любая: кандидат это догадка сопоставителя, но именно
    // его и надо увидеть рядом со святыней.
    const dedRows = await dedications.find({}).toArray();
    const dedSaints = new Map<string, Set<string>>();
    const dedCanon = new Map<string, number>();
    const dedKind = new Map<string, string>();
    for (const d of dedRows as any[]) {
        const ids = new Set<string>();
        for (const s of [...(d.saints ?? []), ...(d.saintCandidates ?? [])]) {
            if (s?.saintId) ids.add(String(s.saintId));
        }
        dedSaints.set(d.slug, ids);
        dedKind.set(d.slug, d.kind);
        if (typeof d.canonized === "number") dedCanon.set(d.slug, d.canonized);
    }

    // ── Святые каталога по храмам: имя храма назвало престолы, престолы — святых.
    const templeSaints = new Map<string, Set<string>>();
    const templeRows = await temples.find(
        { prestoly: { $exists: true, $ne: [] } },
        { projection: { slug: 1, name: 1, year: 1, prestoly: 1 } },
    ).toArray();
    for (const t of templeRows as any[]) {
        const ids = new Set<string>();
        for (const p of t.prestoly ?? []) {
            for (const id of dedSaints.get(p.dedication) ?? []) ids.add(id);
        }
        templeSaints.set(t.slug, ids);
    }

    // Престолы-святые: сколько их всего и у скольких святой разрешается. Прочие
    // престолы (Господские, Богородичные) святого не называют вовсе, и в счёт
    // «неразрешённых» они не идут.
    let saintPrestoly = 0, resolvedPrestoly = 0;
    for (const t of templeRows as any[]) {
        for (const p of t.prestoly ?? []) {
            if (dedKind.get(p.dedication) !== "svyatogo") continue;
            saintPrestoly++;
            if (dedSaints.get(p.dedication)?.size) resolvedPrestoly++;
        }
    }

    console.log(`храмов с престолами: ${templeRows.length}; престолов: `
        + `${templeRows.reduce((n: number, t: any) => n + (t.prestoly?.length ?? 0), 0)}`);
    console.log(`посвящений: ${dedRows.length}; из них со святым каталога: `
        + `${[...dedSaints.values()].filter((s) => s.size).length}`);
    console.log(`престолов, названных святым: ${saintPrestoly}; из них святой разрешается: `
        + `${resolvedPrestoly} (${saintPrestoly ? Math.round(resolvedPrestoly * 100 / saintPrestoly) : 0}%)`);

    // ── 1. Посвящения-святые, ещё не связанные со святым каталога.
    const unlinked = (dedRows as any[])
        .filter((d) => d.kind === "svyatogo" && !(dedSaints.get(d.slug)?.size))
        .map((d) => `${d.slug}  «${d.short}»${typeof d.canonized === "number" ? `  (прославлен ${d.canonized})` : ""}`);
    console.log(`\n1. Посвящения-святые, не связанные со святым каталога: ${unlinked.length}`
        + `\n   связь «посвящение → святой» ещё не поставлена; у прославленных`
        + `\n   (год в скобках) святого может не быть и в самом каталоге:`);
    show(unlinked);

    // ── 2. Святыни и престолы: находки обходчика и записи реестра.
    const templeNamed = new Map(templeRows.map((t: any) => [t.slug, t.name as string]));
    type Row = { origin: string; label: string; ref: string; templeSlug: string | null; saintId: string | null };
    const rows: Row[] = [];

    const cands = await users.collection("relicCandidates")
        .find({ status: "new" }, { projection: { url: 1, templeSlugs: 1, saintCandidates: 1, saintGuess: 1 } })
        .toArray();
    for (const c of cands as any[]) {
        const saintId = c.saintCandidates?.[0]?.id ? String(c.saintCandidates[0].id) : null;
        for (const slug of c.templeSlugs ?? []) {
            rows.push({ origin: "находка", label: c.saintGuess ?? "(святой не назван)", ref: c.url, templeSlug: slug, saintId });
        }
    }

    const relics = await users.collection("relics")
        .find({ status: "approved" }, { projection: { templeSlug: 1, saintId: 1, saintName: 1, siteName: 1, state: 1 } })
        .toArray();
    for (const r of relics as any[]) {
        rows.push({
            origin: "реестр", label: r.saintName ?? "(святой не назван)", ref: r.siteName ?? "",
            templeSlug: r.templeSlug ?? null, saintId: r.saintId ? String(r.saintId) : null,
        });
    }

    let noTemple = 0, noSaint = 0, ok = 0;
    const stray: string[] = [];
    for (const r of rows) {
        if (!r.templeSlug || !templeSaints.has(r.templeSlug)) { noTemple++; continue; }
        if (!r.saintId) { noSaint++; continue; }
        const prestolSaints = templeSaints.get(r.templeSlug)!;
        if (prestolSaints.has(r.saintId)) { ok++; continue; }
        const where = prestolSaints.size ? "престолы храма называют других святых" : "престолы храма не разрешились в святых";
        stray.push(`[${r.origin}] ${r.label} — ${templeNamed.get(r.templeSlug) ?? r.templeSlug} (${where})\n        ${r.ref}`);
    }
    console.log(`\n2. Святыни против престолов: святынь и находок ${rows.length}`
        + `\n   отвечают престолу: ${ok}; не отвечают: ${stray.length}; храм не найден: ${noTemple}; святой не сопоставлен: ${noSaint}`);
    if (stray.length) {
        console.log("   святыня есть, а престола такого нет — смотреть поимённо:");
        show(stray);
    }

    // ── 3. Храм старше прославления своего престола.
    let dated = 0;
    const anachronistic: { line: string; year: number }[] = [];
    for (const t of templeRows as any[]) {
        if (typeof t.year !== "number") continue;
        for (const p of t.prestoly ?? []) {
            const canon = dedCanon.get(p.dedication);
            if (canon === undefined) continue;
            dated++;
            if (t.year < canon - 1) {
                anachronistic.push({
                    year: t.year,
                    line: `${t.year} — «${p.label}» (прославлен ${canon}${p.isMain ? ", главный престол" : ""}) — ${t.name}`,
                });
            }
        }
    }
    anachronistic.sort((a, b) => a.year - b.year);
    console.log(`\n3. Престол и дата храма: датированных пар ${dated}; храм старше прославления: ${anachronistic.length}`);
    if (anachronistic.length) {
        console.log("   заведомо чужой престол или переосвящение — на взгляд:");
        show(anachronistic.map((a) => a.line));
    }

    console.log("\nотчёт; ничего не записано");
    process.exit(0);
};

main().catch((e) => { console.error(e); process.exit(1); });
