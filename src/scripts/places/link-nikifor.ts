// Места: статьи энциклопедии Никифора. Этап 1, шаг 4 — после corpus:import-nikifor
// и трёх шагов обогащения.
//
// Что делает (@/lib/places/nikifor):
//  1. Через Wikidata (P1343 + P805) сводит места со статьями — это сопоставление
//     сделано людьми и принимается как есть.
//  2. Остальные древние места сопоставляет со статьями по общим стихам; надёжное
//     принимается, спорное пишется в `place_nikifor_candidates` на ревью.
//  3. Принятым местам: ключ `nikifor` (алиас текста в корпусе), заглавное слово
//     статьи как библейское русское имя, и оно же — основное имя места, если имя не
//     от редактора.
//
// Если одна статья досталась нескольким местам (энциклопедия пишет одной статьёй
// о городе и его округе), статья остаётся у места с совпавшим именем, прочие пары
// идут на ревью: ключ `nikifor` уникален, как и любой внешний ключ.
//
// Запуск:  npm run places:link-nikifor            # отчёт, ничего не пишет
//          npm run places:link-nikifor -- --write # записать
import "@/scripts/lib/env";
import { readFileSync } from "node:fs";
import path from "node:path";
import clientPromise from "@/lib/mongodb";
import { parseArticle, PREFIX } from "@/scripts/lib/bean";
import { sparql, qidOf } from "@/scripts/lib/wikidata";
import { ArticleInfo, Match, matchByVerses, nameMatches, normalizeName, PlaceInfo, refKeys } from "@/lib/places/nikifor";
import { osisToKey } from "@/lib/places/osis";
import { PLACES } from "@/lib/places/schema";

const WRITE = process.argv.includes("--write");
/** Сколько примеров принятого по стихам показать в отчёте: `--sample 60`. */
const SAMPLE = Number(process.argv[process.argv.indexOf("--sample") + 1]) || 12;
const CACHE = path.join(process.cwd(), "script-data", "nikifor", "wikitext.json");
const CANDIDATES = "place_nikifor_candidates";

async function main() {
    const db = (await clientPromise).db("typikon");
    const places = db.collection(PLACES);

    // Статьи: заглавное слово и стихи — из разметки, алиас — из корпуса.
    const book = await db.collection("books").findOne({ source: "wikisource:БЭАН" });
    if (!book) throw new Error("Книги энциклопедии нет: сначала npm run corpus:import-nikifor -- --apply");
    const aliasOfName = new Map((await db.collection("texts").find({ bookId: book._id }, { projection: { name: 1, alias: 1 } }).toArray())
        .map((t) => [t.name as string, t.alias as string]));

    const wikitext: Record<string, string> = JSON.parse(readFileSync(CACHE, "utf8"));
    const redirects = new Map<string, string>();
    const articles: ArticleInfo[] = [];
    for (const [title, text] of Object.entries(wikitext)) {
        const parsed = parseArticle(title, text);
        if (parsed.kind === "redirect") { redirects.set(title.slice(PREFIX.length), parsed.target); continue; }
        const alias = aliasOfName.get(parsed.name);
        if (!alias) continue;
        articles.push({ alias, headword: parsed.headword, keys: new Set(parsed.bibleRefs.flatMap(refKeys)) });
    }
    const articleByAlias = new Map(articles.map((a) => [a.alias, a]));
    const aliasOfTitle = (title: string) => {
        const name = title.startsWith(PREFIX) ? title.slice(PREFIX.length) : title;
        return aliasOfName.get(name) ?? aliasOfName.get(redirects.get(name) ?? "");
    };

    // Места: русские имена, QID, стихи OpenBible.
    const rows = await places.find({}, { projection: { name: 1, nameSource: 1, names: 1, externals: 1, published: 1 } }).toArray();
    const verseRows = await db.collection("openbible_verses").aggregate([
        { $group: { _id: "$placeId", osis: { $push: "$osis" } } },
    ]).toArray();
    const keysOfPlace = new Map(verseRows.map((v) => [String(v._id), new Set((v.osis as string[]).map(osisToKey).filter(Boolean) as string[])]));
    const info = new Map<string, PlaceInfo>(rows.map((r) => [String(r._id), {
        id: String(r._id),
        keys: keysOfPlace.get(String(r._id)) ?? new Set<string>(),
        ruNames: (r.names ?? []).filter((n: any) => n.lang === "ru" && n.source !== "nikifor").map((n: any) => n.name)
            .concat(/[а-яё]/i.test(r.name) && r.nameSource !== "nikifor" ? [r.name] : []),
        latinNames: (r.names ?? []).filter((n: any) => n.source === "openbible").map((n: any) => n.name as string),
    }]));

    // 1. Wikidata.
    const pairs = await sparql(`SELECT ?item ?title WHERE {
      ?item p:P1343 ?st . ?st ps:P1343 wd:Q4086271 ; pq:P805 ?art .
      ?sl schema:about ?art ; schema:isPartOf <https://ru.wikisource.org/> ; schema:name ?title }`);
    const placeOfQid = new Map<string, string>();
    for (const r of rows) for (const e of r.externals ?? []) if (e.source === "wikidata") placeOfQid.set(e.id, String(r._id));

    const matches: Match[] = [];
    let wikidataUnknownTitle = 0;
    for (const p of pairs) {
        const placeId = placeOfQid.get(qidOf(p.item?.value) ?? "");
        if (!placeId) continue;
        const alias = aliasOfTitle(p.title!.value);
        if (!alias) { wikidataUnknownTitle++; continue; }
        matches.push({ placeId, alias, overlap: 0, via: "wikidata", decision: "auto", reason: "Wikidata P1343/P805" });
    }

    // 2. По стихам — для мест и статей, которых Wikidata не коснулась.
    const byWikidataPlace = new Set(matches.map((m) => m.placeId));
    const byWikidataArticle = new Set(matches.map((m) => m.alias));
    matches.push(...matchByVerses(
        articles.filter((a) => !byWikidataArticle.has(a.alias) && a.keys.size),
        [...info.values()].filter((p) => !byWikidataPlace.has(p.id) && p.keys.size),
    ));

    // Одна статья у нескольких мест. Wikidata ставит источник и элементу о древнем
    // городе, и элементу о нынешнем (Смирна и Измир), а у нас это разные записи. Статья
    // Никифора — о библейском месте, поэтому остаётся у записи со стихами OpenBible;
    // если таких нет или несколько — у записи с совпавшим именем; иначе всё на ревью.
    const byAlias = new Map<string, Match[]>();
    for (const m of matches.filter((m) => m.decision === "auto")) {
        if (!byAlias.has(m.alias)) byAlias.set(m.alias, []);
        byAlias.get(m.alias)!.push(m);
    }
    for (const [alias, group] of byAlias) {
        if (group.length < 2) continue;
        const article = articleByAlias.get(alias)!;
        const biblical = group.filter((m) => info.get(m.placeId)!.keys.size > 0);
        const named = (biblical.length > 1 ? biblical : group).filter((m) => nameMatches(info.get(m.placeId)!, article));
        const keeper = biblical.length === 1 ? biblical[0] : named.length === 1 ? named[0] : undefined;
        for (const m of group) {
            if (m === keeper) continue;
            m.decision = "pending";
            m.reason = `статья у ${group.length} мест${keeper ? ", оставлена у другого" : ""}`;
        }
    }

    const accepted = matches.filter((m) => m.decision === "auto");
    const pending = matches.filter((m) => m.decision === "pending");
    const rowById = new Map(rows.map((r) => [String(r._id), r]));
    const nameOf = (id: string) => rowById.get(id)?.name;

    console.log(`\n=== Отчёт ===`);
    console.log(`Статей: ${articles.length}, со стихами: ${articles.filter((a) => a.keys.size).length}; мест со стихами OpenBible: ${[...info.values()].filter((p) => p.keys.size).length}`);
    console.log(`Wikidata: пар ${pairs.length}, к нашим местам ${matches.filter((m) => m.via === "wikidata").length}; заголовков, которых нет в корпусе: ${wikidataUnknownTitle}`);
    console.log(`Принято: ${accepted.length} (Wikidata ${accepted.filter((m) => m.via === "wikidata").length}, по стихам ${accepted.filter((m) => m.via === "verses").length}); на ревью: ${pending.length}`);
    console.log(`Мест со статьёй: ${new Set(accepted.map((m) => m.placeId)).size}`);
    console.log(`Примеры по стихам:`);
    // Равномерно по списку, а не первые по алфавиту: иначе видна одна буква «А».
    const byVerses = accepted.filter((m) => m.via === "verses");
    const step = Math.max(1, Math.floor(byVerses.length / SAMPLE));
    for (const m of byVerses.filter((_, i) => i % step === 0).slice(0, SAMPLE)) {
        console.log(`  ${nameOf(m.placeId)} ← ${articleByAlias.get(m.alias)!.headword} (${m.reason})`);
    }
    console.log(`Примеры на ревью:`);
    for (const m of pending.slice(0, 8)) console.log(`  ${nameOf(m.placeId)} ? ${articleByAlias.get(m.alias)!.headword} (${m.reason})`);

    // Записи: ключи и имена.
    const acceptedByPlace = new Map<string, Match[]>();
    for (const m of accepted) {
        if (!acceptedByPlace.has(m.placeId)) acceptedByPlace.set(m.placeId, []);
        acceptedByPlace.get(m.placeId)!.push(m);
    }
    let renamed = 0;
    const now = new Date();
    const updates = [...acceptedByPlace].map(([placeId, group]) => {
        const row = rowById.get(placeId)!;
        const place = info.get(placeId)!;
        // Заглавие статьи бывает перечнем форм («Киринеи, Киринеянин, Кирены»): каждая
        // форма — библейское имя, но основным именем места становится только одна.
        const heads = [...new Set(group.flatMap((m) => articleByAlias.get(m.alias)!.headword.split(/\s*[,;]\s*/)).filter(Boolean))];
        const known = heads.find((h) => place.ruNames.some((n) => normalizeName(n) === normalizeName(h)));
        const single = group.length === 1 && !/[,;]/.test(articleByAlias.get(group[0].alias)!.headword) ? heads[0] : undefined;
        // Форма Никифора вытесняет русское имя из Wikidata, только если сопоставление
        // сделано людьми (Wikidata) — по стихам и созвучию оно лишь угадано, и
        // «Филистия» не должна стать «Палестиной» из-за общего стиха.
        const trusted = group.some((m) => m.via === "wikidata") || place.ruNames.length === 0;
        const primary = known ?? (trusted ? single : undefined);
        const nameSource = row.nameSource ?? (row.published === false ? "openbible" : "editor");
        const set: Record<string, any> = {
            externals: [
                ...(row.externals ?? []).filter((e: any) => e.source !== "nikifor"),
                ...group.map((m) => ({ source: "nikifor", id: m.alias })),
            ],
            names: [
                ...(row.names ?? []).filter((n: any) => n.source !== "nikifor"),
                ...heads.map((h) => ({ name: h, lang: "ru", role: "biblical", source: "nikifor" })),
            ],
            updatedAt: now,
        };
        if (primary && nameSource !== "editor" && row.name !== primary) {
            Object.assign(set, { name: primary, nameSource: "nikifor" });
            renamed++;
        }
        return { _id: row._id, set };
    });
    console.log(`Переименовано бы по заглавному слову статьи: ${renamed}`);

    if (!WRITE) {
        console.log(`Ничего не записано. Для записи: --write`);
        process.exit(0);
    }

    // Снятые с места статьи (прошлый прогон принял, этот — нет) тоже надо убрать.
    await places.updateMany(
        { "externals.source": "nikifor", _id: { $nin: updates.map((u) => u._id) } },
        { $pull: { externals: { source: "nikifor" }, names: { source: "nikifor" } } as any },
    );
    for (const u of updates) await places.updateOne({ _id: u._id }, { $set: u.set });

    const candidates = db.collection(CANDIDATES);
    await candidates.deleteMany({ status: "pending" });
    if (pending.length) {
        await candidates.insertMany(pending.map((m) => ({
            placeId: rowById.get(m.placeId)!._id, alias: m.alias, overlap: m.overlap,
            via: m.via, reason: m.reason, status: "pending", createdAt: now,
        })));
    }
    console.log(`Записано: мест ${updates.length}, кандидатов на ревью ${pending.length}`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
