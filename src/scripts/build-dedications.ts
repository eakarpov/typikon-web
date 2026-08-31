// Словарь посвящений в базу: посвящение -> память устава -> святой.
//
// ЧТО ЗДЕСЬ ПРОИСХОДИТ. Сам словарь живёт в коде (@/utils/dedications) и
// правится руками: это утверждения о том, кому посвящён храм с таким именем,
// и место им в git, а не в базе. Скрипт делает другое — СВЯЗЫВАЕТ его с двумя
// хранилищами, которые о словаре ничего не знают:
//
//   праздник (месяц и число) -> memories корпуса устава (RULES_DB)
//   память                   -> memory_saint_links -> saints (Mongo)
//
// Без первой связи посвящение не поедет в устав: движку нужен memory_id, из
// него он берёт и тропарь, и кондак, и канон храма. Без второй на карточке
// храма нечем подписать престол и некуда сослаться.
//
// ПРОВЕРКА ЗДЕСЬ ВАЖНЕЕ ЗАПИСИ. Дата в словаре набрана руками, и ошибиться в
// ней легко: 6 декабря против 9 мая — оба Никольские, но памяти разные. Поэтому
// у записи есть `expect` — обломок метки памяти, и найденное по дате сверяется
// с ним. Разошлось — это сообщается, а связь не ставится: лучше престол без
// памяти, чем престол с чужой.
//
// Ничего не пишет без --write.
//
// Запуск:  npm run temples:dedications [-- --write] [-- --show 40]
import "@/scripts/lib/env";
import Database from "better-sqlite3";
import clientPromise from "@/lib/mongodb";
import { DEDICATIONS, type Dedication, type DedicationFeast } from "@/utils/dedications";

/** Снятые ударения и ё/е — сравнивать метки иначе бесполезно. */
const plain = (s: string) => s.toLowerCase().replace(/́/g, "").replace(/ё/g, "е");

interface ResolvedFeast extends DedicationFeast {
    memoryId: string | null;
    memoryLabel: string | null;
    sign: string | null;
    /** Почему памяти нет или почему она под сомнением. */
    problem?: string;
}

interface MemoryRow { memory_id: string; label: string | null }

const main = async () => {
    const argv = process.argv;
    const write = argv.includes("--write");
    const show = Number(argv[argv.indexOf("--show") + 1]) || 25;

    const file = process.env.RULES_DB;
    if (!file) { console.error("нет RULES_DB в окружении"); process.exit(1); }
    const rules = new Database(file, { readonly: true, fileMustExist: true });

    const byDate = rules.prepare(`
        SELECT m.memory_id, m.label FROM memories m
        WHERE m.book = 'menaion' AND m.month = ? AND m.day = ?
          AND m.memory_id NOT LIKE '%-cycle'
        ORDER BY length(m.memory_id), m.memory_id`);
    const byOffset = rules.prepare(`
        SELECT memory_id, label FROM memories
        WHERE pascha_offset = ? ORDER BY length(memory_id), memory_id`);
    const signOf = rules.prepare("SELECT default_sign FROM memory_signs WHERE memory_id = ?");

    const resolveFeast = (d: Dedication, feast: DedicationFeast): ResolvedFeast => {
        const rows = (feast.paschaOffset !== undefined
            ? byOffset.all(feast.paschaOffset)
            : byDate.all(feast.month, feast.day)) as MemoryRow[];

        if (!rows.length) {
            return { ...feast, memoryId: null, memoryLabel: null, sign: null, problem: "памяти на эту дату в корпусе нет" };
        }

        // Ожидание проверяем ПО ВСЕМ памятям дня, а не по первой: 6 декабря
        // первой стоит Николай, но 30 августа — Александр Невский третьим.
        // Сверка попраздничная, а где её нет — общая по записи.
        const expect = feast.expect ?? d.expect;
        let picked = rows[0];
        if (expect) {
            const wanted = plain(expect);
            const hit = rows.find((r) => plain(r.label ?? "").includes(wanted));
            if (!hit) {
                return {
                    ...feast, memoryId: null, memoryLabel: null, sign: null,
                    problem: `на эту дату нет памяти с «${expect}»; есть: ${rows.map((r) => (r.label ?? r.memory_id).slice(0, 40)).join(" / ")}`,
                };
            }
            picked = hit;
        }

        const sign = (signOf.get(picked.memory_id) as { default_sign: string | null } | undefined)?.default_sign ?? null;
        return { ...feast, memoryId: picked.memory_id, memoryLabel: picked.label, sign };
    };

    const client = await clientPromise;
    const db = client.db("typikon");
    const links = db.collection("memory_saint_links");
    const saints = db.collection("saints");

    const resolved = DEDICATIONS.map((d) => ({ dedication: d, feasts: d.feasts.map((f) => resolveFeast(d, f)) }));

    // Святой — через связь памяти со святцами. Связи эти НЕ ВЫВЕРЕНЫ: они
    // выведены сопоставителем и лежат в очереди на разбор (все 653 со статусом
    // pending). Догадка там бывает и мимо: Ильинскому храму сопоставитель
    // предлагает «Илия Севастийского», а не пророка Илию.
    //
    // Потому связи раскладываются надвое: выверенные идут в `saints` и
    // показываются, невыверенные — в `saintCandidates`, и видит их только
    // разбор в админке. Иначе первая же страница храма подписала бы престол
    // чужим именем, и поправить это было бы некому: на вид оно как настоящее.
    const memoryIds = resolved.flatMap((r) => r.feasts.map((f) => f.memoryId).filter(Boolean)) as string[];
    const linkRows = await links.find({ memoryId: { $in: memoryIds } }).toArray();
    const linkBy = new Map(linkRows.map((l: any) => [l.memoryId, l]));
    const dneslovIds = [...new Set(linkRows.map((l: any) => l.dneslovId).filter(Boolean))];
    const saintRows = await saints.find({ "externals.id": { $in: dneslovIds }, "externals.source": "dneslov" }).toArray();
    const saintBy = new Map<string, any>();
    for (const s of saintRows) {
        for (const e of (s.externals ?? []) as any[]) {
            if (e.source === "dneslov") saintBy.set(String(e.id), s);
        }
    }

    const APPROVED = ["ok", "approved", "confirmed"];

    const docs = resolved.map(({ dedication: d, feasts }) => {
        const linked = feasts
            .map((f) => (f.memoryId ? linkBy.get(f.memoryId) : null))
            .filter(Boolean)
            .map((l: any) => {
                const s = saintBy.get(String(l.dneslovId));
                return {
                    dneslovId: String(l.dneslovId), fromMemory: l.memoryId, status: l.status,
                    name: s?.name ?? l.saintName ?? null, slug: s?.slug ?? null,
                };
            });
        const seen = new Set<string>();
        const unique = linked.filter((s) => !seen.has(s.dneslovId) && seen.add(s.dneslovId));
        return {
            slug: d.slug, label: d.label, short: d.short, kind: d.kind,
            ...(d.canonized ? { canonized: d.canonized } : {}),
            patterns: d.patterns.map((p) => p.source),
            feasts: feasts.map(({ problem, ...f }) => f),
            saints: unique.filter((s) => APPROVED.includes(s.status)),
            saintCandidates: unique.filter((s) => !APPROVED.includes(s.status)),
            updatedAt: new Date(),
        };
    });

    // ── Отчёт ────────────────────────────────────────────────────────────────
    const allFeasts = resolved.flatMap((r) => r.feasts);
    const noFeasts = resolved.filter((r) => !r.feasts.length);
    const problems = resolved.flatMap((r) => r.feasts.filter((f) => f.problem).map((f) => ({ slug: r.dedication.slug, f })));
    const withMemory = docs.filter((d) => d.feasts.some((f) => f.memoryId));
    const withSaint = docs.filter((d) => d.saints.length);
    const withCandidate = docs.filter((d) => !d.saints.length && d.saintCandidates.length);

    console.log(`посвящений в словаре: ${DEDICATIONS.length}`);
    console.log(`  праздников: ${allFeasts.length}; из них с памятью: ${allFeasts.filter((f) => f.memoryId).length}`);
    console.log(`  посвящений с памятью: ${withMemory.length}; с выверенным святым: ${withSaint.length}` +
        `; ждут разбора связи святого: ${withCandidate.length}`);
    console.log(`  без единого праздника (память ещё не выяснена): ${noFeasts.length}` +
        (noFeasts.length ? ` — ${noFeasts.map((r) => r.dedication.slug).join(", ")}` : ""));

    if (problems.length) {
        console.log(`\n!! памятей не нашлось: ${problems.length}`);
        problems.slice(0, show).forEach(({ slug, f }) => {
            const when = f.paschaOffset !== undefined ? `Пасха${f.paschaOffset >= 0 ? "+" : ""}${f.paschaOffset}` : `${f.day}.${f.month}`;
            console.log(`   ${slug} (${when}): ${f.problem}`);
        });
        if (problems.length > show) console.log(`   … и ещё ${problems.length - show}`);
    }

    // Полный разбор глазами: дата сама по себе ничего не доказывает — 30
    // августа в Минее не одна память, и увидеть, ЧТО именно выбрано, можно
    // только списком. Для записей без `expect` это единственная проверка.
    if (argv.includes("--list")) {
        console.log("");
        for (const { dedication: d, feasts } of resolved) {
            for (const f of feasts) {
                const when = f.paschaOffset !== undefined
                    ? `Пасха${f.paschaOffset >= 0 ? "+" : ""}${f.paschaOffset}`.padEnd(9)
                    : `${String(f.day).padStart(2)}.${String(f.month).padStart(2)}     `;
                const mark = (f.expect ?? d.expect) ? "  " : " ?";  // «?» — сверять было нечем
                console.log(`${mark} ${d.slug.padEnd(28)} ${when} ${(f.memoryLabel ?? "— нет —").slice(0, 62)}`);
            }
        }
    }

    if (!write) {
        console.log("\nпробный прогон; чтобы записать — --write");
        return;
    }

    const target = db.collection("dedications");
    await target.createIndex({ slug: 1 }, { unique: true });
    for (const doc of docs) {
        await target.updateOne({ slug: doc.slug }, { $set: doc, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    }
    // Записи, выпавшие из словаря, из базы уходят: словарь — источник истины.
    const gone = await target.deleteMany({ slug: { $nin: docs.map((d) => d.slug) } });
    console.log(`\nзаписано: ${docs.length}; удалено выпавших: ${gone.deletedCount}`);
};

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
