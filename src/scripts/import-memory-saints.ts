// Заводит в каталог святых лица из памятей нашей Минеи — тех, кого в каталоге
// нет. Разбор подписи — @/lib/memorySaints; здесь сведение, решение и запись.
//
// ИСТОЧНИК НАШ. Памяти приезжают выгрузкой typikon-rules (export_memories.py →
// npm run memories:import) вместе с адресом памяти: он говорит, что память —
// лица, а не праздника, собора или иконы. Чужих святцев скрипт не спрашивает.
//
// ЧТО ЗАВОДИТСЯ СРАЗУ, А ЧТО ИДЁТ ЧЕЛОВЕКУ. Сразу — лицо с именем и прозванием,
// одно в подписи, которого в каталоге нет ни по имени с прозванием, ни по имени
// с днём памяти. Остальное — в очередь `saint_proposals` (разбор в
// /admin/saints/proposals) с причиной: без прозвания («Митрофа́на, Патриа́рха
// Константи́ня гра́да» — тёзок не различить), несколько лиц в подписи, или похоже
// на уже заведённую запись.
//
// УЖЕ В КАТАЛОГЕ — не повод для записи. Если у святого каталога то же имя и
// среди дней памяти тот же день, память — его, и ничего не заводится: заводить
// второго Серафима Саровского хуже, чем не завести никого.
//
// ПОВТОРЯЕМО. Запись узнаётся по памятям в `provenance` (таблица `memories`);
// предложение — по ключу лица. Поля из `manual` не трогаются, как в
// build-saints.ts и import-sobor-saints.ts. Слуги и URI здесь не ставятся: их
// ставят assign-saint-slugs.ts --with-corpus и push_saint_uris.py typikon-rules.
//
// Запуск:  npm run saints:memories  [-- --write]
import "@/scripts/lib/env";
import clientPromise from "@/lib/mongodb";
import { bare, CHIN_WORDS, churchDate, personOf, rankOf, type MemoryPerson } from "@/lib/memorySaints";

const WRITE = process.argv.includes("--write");
const TABLE = "memories";
const DERIVED = ["name", "type", "memoryDates"] as const;

type Reason = "no-name" | "no-epithet" | "several" | "possible-duplicate";

interface MemoryRow {
    _id: string;
    book: string;
    label: string;
    month: number | null;
    day: number | null;
    address: string | null;
    chin: string | null;
}

interface Group {
    key: string;
    person: MemoryPerson | null;
    memories: MemoryRow[];
    reason: Reason | null;
    duplicates: { id: string; name: string; slug: string | null }[];
}

const main = async () => {
    const db = (await clientPromise).db("typikon");
    const memories = (await db.collection("memories").find(
        { address: { $regex: "/(saint|relics)/" }, month: { $type: "number" }, day: { $type: "number" } },
        { projection: { book: 1, label: 1, month: 1, day: 1, address: 1, chin: 1 } },
    ).toArray()) as unknown as MemoryRow[];
    if (!memories.length) {
        console.error("памятей с адресом нет — выгрузите их: python3 scripts/export_memories.py (typikon-rules), затем npm run memories:import");
        process.exit(1);
    }

    const linked = new Set<string>(await db.collection("memory_saint_links").distinct("memoryId", { status: "approved" }));
    const saints = await db.collection("saints").find({}, {
        projection: { name: 1, altNames: 1, slug: 1, memoryDates: 1, provenance: 1, manual: 1, externals: 1 },
    }).toArray();

    // Уже заведённые этим скриптом: память → запись.
    const imported = new Map<string, any>();
    for (const s of saints) for (const p of (s as any).provenance ?? []) if (p.table === TABLE) imported.set(String(p.id), s);

    // Каталог для сличения: по первому слову имени (и прочих имён) — записи с их днями.
    const byGiven = new Map<string, any[]>();
    const names = (s: any) => [s.name, ...(s.altNames ?? [])].filter(Boolean).map((n: string) => bare(n));
    for (const s of saints) {
        for (const n of names(s)) {
            const given = n.split(/\s+/)[0];
            byGiven.set(given, [...(byGiven.get(given) ?? []), s]);
        }
    }
    const epithetStem = (e: string) => bare(e).slice(0, Math.max(4, bare(e).length - 3));
    // Тот же день и то же имя — ещё не тот же святой: у Александра Невского
    // 23 ноября память общая с новомучеником Александром Уксусовым. Если книга
    // называет прозвание, оно должно найтись и у записи каталога.
    const sameDay = (person: MemoryPerson, date: string) =>
        (byGiven.get(bare(person.given)) ?? []).find((s: any) => (s.memoryDates ?? []).includes(date)
            && (!person.epithet || names(s).some((n) => n.includes(epithetStem(person.epithet!)))
                // Одно прозвание в двух написаниях: «Ни́сский» в святцах и «Нисси́йский» в
                // Минее. При том же имени и дне довольно совпадения первых четырёх букв.
                || names(s).some((n) => n.split(/\s+/).slice(1).some((w) => w.length >= 5
                    && w.slice(0, 4) === bare(person.epithet!).slice(0, 4)))
                // Запись каталога вовсе без прозвания («Тимофе́й») с тем же днём —
                // тот же святой: прозвание ей просто не записали. Иное прозвание
                // или фамилия (Уксусов) — другой человек.
                || bare(s.name ?? "").split(/\s+/).length === 1));
    const sameName = (person: MemoryPerson) => {
        if (!person.epithet) return [];
        const stem = epithetStem(person.epithet);
        // Запись попадает в указатель и по имени, и по прочим именам — сводим её в одну.
        return [...new Set((byGiven.get(bare(person.given)) ?? []).filter((s: any) => names(s).some((n) => n.includes(stem))))];
    };

    let skippedLinked = 0, knownByDay = 0;
    const groups = new Map<string, Group>();
    const byPerson = new Map<string, { m: MemoryRow; person: MemoryPerson }[]>();
    for (const m of memories) {
        if (linked.has(m._id)) { skippedLinked++; continue; }
        // Память, присоединённая к записи из святцев (слиянием или «это он»), —
        // святой уже в каталоге; заводить и обновлять тут нечего.
        if (((imported.get(m._id) as any)?.externals ?? []).length) { knownByDay++; continue; }
        const date = churchDate(m.month!, m.day!);
        const person = personOf(m.label, m.chin);
        if (person && !imported.has(m._id) && sameDay(person, date)) { knownByDay++; continue; }

        // Сводим по имени с прозванием; без прозвания или с несколькими лицами —
        // каждая память сама по себе: голое имя сводило бы разных людей.
        const clear = person && person.epithet && !person.several;
        if (!clear) {
            const key = `memory:${m._id}`;
            groups.set(key, { key, person, memories: [m], reason: null, duplicates: [] });
            continue;
        }
        byPerson.set(person!.key, [...(byPerson.get(person!.key) ?? []), { m, person: person! }]);
    }

    // Памяти одного имени с прозванием делим по чину. Князь совместим с любым
    // чином (князья — и мученики, и иноки: Михаил Черниговский, Даниил Московский),
    // святитель — со священномучеником; прочие разные чины — разные люди
    // (Андрей Критский: святитель 4 июля и преподобномученик 17 октября).
    // Память мощей и память без чина идут к единственному лицу; если лиц
    // несколько — к человеку.
    const rankClass = (r: string) => (r === "hieromartyr" ? "hierarch" : r);
    for (const [personKey, list] of byPerson) {
        const ranked = new Map<string, typeof list>();
        const loose: typeof list = [];
        for (const item of list) {
            const r = rankClass(rankOf(item.m.label));
            const relics = /\/relics\//.test(item.m.address ?? "");
            if (relics || r === "ruler" || r === "?") loose.push(item);
            else ranked.set(r, [...(ranked.get(r) ?? []), item]);
        }
        const parts = [...ranked.entries()];
        if (parts.length <= 1) {
            const key = `${personKey}|${parts[0]?.[0] ?? "any"}`;
            groups.set(key, { key, person: list[0].person, memories: list.map((x) => x.m), reason: null, duplicates: [] });
            continue;
        }
        for (const [r, items] of parts) {
            const key = `${personKey}|${r}`;
            groups.set(key, { key, person: items[0].person, memories: items.map((x) => x.m), reason: null, duplicates: [] });
        }
        for (const item of loose) {
            const key = `memory:${item.m._id}`;
            groups.set(key, { key, person: item.person, memories: [item.m], reason: "several", duplicates: [] });
        }
    }

    for (const g of groups.values()) {
        if (g.reason) continue;
        if (!g.person) g.reason = "no-name";
        else if (g.person.several) g.reason = "several";
        else if (!g.person.epithet) g.reason = "no-epithet";
        else {
            // Уже заведённое этим же скриптом — своё, а не «похожее».
            const own = g.memories.map((m) => imported.get(m._id)).find(Boolean);
            const similar = sameName(g.person).filter((s: any) => !own || String(s._id) !== String(own._id));
            if (similar.length) {
                g.reason = "possible-duplicate";
                g.duplicates = similar.slice(0, 5).map((s: any) => ({ id: String(s._id), name: s.name, slug: s.slug ?? null }));
            }
        }
    }

    // Одна запись каталога не должна обновляться двумя лицами — это значит, что
    // прежний прогон свёл их, а нынешний различил: такое решает человек.
    const byRecord = new Map<string, string[]>();
    for (const g of groups.values()) {
        if (g.reason) continue;
        const rec = g.memories.map((m) => imported.get(m._id)).find(Boolean);
        if (rec) byRecord.set(String(rec._id), [...(byRecord.get(String(rec._id)) ?? []), g.key]);
    }
    const split = [...byRecord].filter(([, keys]) => keys.length > 1);
    if (split.length) {
        console.log(`записи, которые теперь делятся на лица (${split.length}) — развести руками:`);
        for (const [rec, keys] of split) console.log(`  ${rec}: ${keys.join(" / ")}`);
        if (WRITE) { console.error("запись остановлена: сначала развести эти записи"); process.exit(1); }
    }

    const create = [...groups.values()].filter((g) => !g.reason);
    const propose = [...groups.values()].filter((g) => g.reason);
    const by = (r: Reason) => propose.filter((g) => g.reason === r).length;
    console.log(`памятей лиц с числом месяца: ${memories.length}; связаны проверенной связью: ${skippedLinked}; `
        + `святой уже в каталоге (имя и день): ${knownByDay}`);
    console.log(`заводится лиц: ${create.length} (${create.reduce((n, g) => n + g.memories.length, 0)} памятей); `
        + `на разбор: ${propose.length} — без прозвания ${by("no-epithet")}, несколько лиц ${by("several")}, `
        + `похоже на запись каталога ${by("possible-duplicate")}, имени нет ${by("no-name")}`);
    for (const g of (process.env.SHOW_ALL ? create : create.slice(0, 12))) {
        console.log(`  + ${g.person!.name}  ${g.memories.map((m) => churchDate(m.month!, m.day!)).join(", ")}  ⟵ ${g.memories[0].label.slice(0, 70)}`);
    }
    for (const g of propose.filter((x) => x.reason === "possible-duplicate").slice(0, 6)) {
        console.log(`  ? ${g.person!.name} ~ ${g.duplicates.map((d) => d.name).join("; ")}`);
    }

    if (!WRITE) {
        console.log("холостой прогон — ничего не записано; --write запишет");
        process.exit(0);
    }

    const col = db.collection("saints");
    let inserted = 0, updated = 0;
    for (const g of create) {
        const provenance = g.memories.map((m) => ({
            table: TABLE, id: m._id, edition: m.book, chin: (m.chin && CHIN_WORDS[m.chin]) ?? null,
            office: null, text: m.label, url: null,
        }));
        const memoryDates = [...new Set(g.memories.map((m) => churchDate(m.month!, m.day!)))];
        const derived = { name: g.person!.name, type: "Identity", memoryDates };
        const existing = g.memories.map((m) => imported.get(m._id)).find(Boolean);
        // Память, присоединённая к записи из святцев (слиянием или «это он»), —
        // уже не наша запись: её имя и дни ведёт build-saints.ts, и переписывать их
        // выведенным из Минеи нельзя.
        if (existing && ((existing as any).externals ?? []).length) continue;
        if (existing) {
            const manual = new Set<string>((existing as any).manual ?? []);
            const set: Record<string, unknown> = { provenance: [
                ...((existing as any).provenance ?? []).filter((p: any) => p.table !== TABLE), ...provenance,
            ], updatedAt: new Date() };
            for (const f of DERIVED) if (!manual.has(f)) set[f] = derived[f];
            await col.updateOne({ _id: (existing as any)._id }, { $set: set });
            updated++;
        } else {
            await col.insertOne({
                slug: null, ...derived, altNames: [], title: null, orders: [], councils: [], baseYear: null,
                imageUrl: null, roundelUrl: null, images: [], externals: [], provenance, manual: [],
                createdAt: new Date(), updatedAt: new Date(),
            });
            inserted++;
        }
    }

    const proposals = db.collection("saint_proposals");
    for (const g of propose) {
        await proposals.updateOne({ _id: g.key as any }, {
            $set: {
                name: g.person?.name ?? null, given: g.person?.given ?? null, epithet: g.person?.epithet ?? null,
                reason: g.reason, duplicates: g.duplicates,
                memories: g.memories.map((m) => ({ id: m._id, book: m.book, label: m.label, date: churchDate(m.month!, m.day!), chin: m.chin })),
                updatedAt: new Date(),
            },
            // Решение человека повторный прогон не отменяет.
            $setOnInsert: { status: "new", createdAt: new Date() },
        }, { upsert: true });
    }
    // Нерешённое предложение, которого этот прогон уже не выдаёт, устарело: его
    // память теперь узнаётся в каталоге или заведена. Решённые человеком не трогаем.
    const stale = await proposals.deleteMany({ status: "new", _id: { $nin: propose.map((g) => g.key) as any[] } });
    console.log(`записано: заведено ${inserted}, обновлено ${updated}; предложений на разбор ${propose.length}; `
        + `снято устаревших ${stale.deletedCount}`);
    process.exit(0);
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
