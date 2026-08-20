// Тянет из Wikidata княжеский ствол Рюриковичей (прямой P53=Рюриковичи) + одну границу наружу
// (супруги и дети, не помеченные P53=Рюриковичи — точки стыковки с другими родами) и раскладывает
// в staging_families/staging_nobles/staging_couples (см. migration-001, ROADMAP.md) на ревью в
// /admin/nobles/import. Ничего не пишет в nobles/families/couples напрямую — только staging.
//
// Запуск (локально, .env.development):
//   NODE_ENV=development npx tsx -r tsconfig-paths/register src/scripts/import-nobles-wikidata.ts
// или через npm-скрипт: npm run nobles:import-wikidata -- --dev
import "@/scripts/lib/env";
import { init } from "@/lib/sqlite";
import { formatWikidataDate, extractYearFromIso } from "@/scripts/lib/wikidataDate";

const ENDPOINT = "https://query.wikidata.org/sparql";
const UA = "typikon-web/1.0 (nobles import script, contact: georgecarpow@gmail.com)";
const RURIKID_QID = "Q210398"; // Рюриковичи

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Row = Record<string, { value: string; type: string } | undefined>;

async function sparql(query: string, retries = 4): Promise<Row[]> {
    const url = `${ENDPOINT}?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: "application/sparql-results+json", "User-Agent": UA } });
    if (res.status === 429 || res.status === 503 || res.status === 502) {
        if (retries <= 0) throw new Error(`SPARQL ${res.status}: rate-limited, retries exhausted`);
        const retryAfter = Number(res.headers.get("retry-after")) || 10;
        await sleep(retryAfter * 1000);
        return sparql(query, retries - 1);
    }
    if (!res.ok) throw new Error(`SPARQL ${res.status}: ${await res.text()}`);
    return (await res.json()).results.bindings as Row[];
}

const qid = (uri?: string) => uri?.split("/").pop();
const GENDER_MALE = "Q6581097";
const GENDER_FEMALE = "Q6581072";

const stripDisambiguation = (name: string) => name.replace(/\s*\([^)]*\)\s*/g, " ").trim();
const normalizeName = (name: string) =>
    stripDisambiguation(name)
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[^a-zа-я0-9 ]/gi, "")
        .replace(/\s+/g, " ")
        .trim();
const extractYear = (text?: string | null) => {
    if (!text) return undefined;
    const m = text.match(/\d{3,4}/);
    return m ? Number(m[0]) : undefined;
};

type CorePerson = {
    id: string;
    name: string;
    birth?: string;
    birthYear?: number;
    birthPrecision?: number;
    death?: string;
    deathYear?: number;
    deathPrecision?: number;
    gender?: string;
    father?: string;
    mother?: string;
    isSaintOrthodox: boolean;
    isSaintCatholic: boolean;
    canonizationLabels: Set<string>;
};

// P411 (canonization status) отдаёт конкретный ранг ("равноапостольный", "благоверный", "блаженный"
// и т.д.), а не просто факт святости — по нему и различаем православное/католическое почитание,
// а не пишем вслепую в одно поле и не зануляем второе константой.
const CATHOLIC_CANONIZATION_KEYWORDS = ["блажен", "beatif", "catholic", "католич"];
const classifyCanonization = (label: string): "orthodox" | "catholic" => {
    const l = label.toLowerCase();
    return CATHOLIC_CANONIZATION_KEYWORDS.some((k) => l.includes(k)) ? "catholic" : "orthodox";
};

async function fetchCore(): Promise<Map<string, CorePerson>> {
    const rows = await sparql(`
        SELECT ?person ?personLabel ?birth ?birthPrecision ?death ?deathPrecision ?gender ?father ?mother ?canonization ?canonizationLabel WHERE {
            ?person wdt:P53 wd:${RURIKID_QID} .
            OPTIONAL {
                ?person p:P569 ?bStmt . ?bStmt psv:P569 ?bNode .
                ?bNode wikibase:timeValue ?birth ; wikibase:timePrecision ?birthPrecision .
            }
            OPTIONAL {
                ?person p:P570 ?dStmt . ?dStmt psv:P570 ?dNode .
                ?dNode wikibase:timeValue ?death ; wikibase:timePrecision ?deathPrecision .
            }
            OPTIONAL { ?person wdt:P21 ?gender }
            OPTIONAL { ?person wdt:P22 ?father }
            OPTIONAL { ?person wdt:P25 ?mother }
            OPTIONAL { ?person wdt:P411 ?canonization }
            SERVICE wikibase:label { bd:serviceParam wikibase:language "ru,en". }
        }
    `);
    const byId = new Map<string, CorePerson>();
    for (const r of rows) {
        const id = qid(r.person?.value)!;
        const rec: CorePerson =
            byId.get(id) ?? {
                id,
                name: (r as any).personLabel?.value ?? id,
                isSaintOrthodox: false,
                isSaintCatholic: false,
                canonizationLabels: new Set(),
            };
        // Wikidata может отдать несколько statement'ов на одно и то же свойство (например, при
        // спорной/уточнённой дате) — берём тот, что с самой высокой точностью (день лучше года).
        if (r.birth) {
            const precision = Number((r as any).birthPrecision.value);
            if (rec.birthPrecision === undefined || precision > rec.birthPrecision) {
                rec.birth = formatWikidataDate(r.birth.value, precision);
                rec.birthYear = extractYearFromIso(r.birth.value);
                rec.birthPrecision = precision;
            }
        }
        if (r.death) {
            const precision = Number((r as any).deathPrecision.value);
            if (rec.deathPrecision === undefined || precision > rec.deathPrecision) {
                rec.death = formatWikidataDate(r.death.value, precision);
                rec.deathYear = extractYearFromIso(r.death.value);
                rec.deathPrecision = precision;
            }
        }
        rec.gender ??= qid(r.gender?.value);
        rec.father ??= qid(r.father?.value);
        rec.mother ??= qid(r.mother?.value);
        const canonizationLabel = (r as any).canonizationLabel?.value as string | undefined;
        if (r.canonization) {
            rec.canonizationLabels.add(canonizationLabel ?? qid(r.canonization.value)!);
            if (classifyCanonization(canonizationLabel ?? "") === "catholic") rec.isSaintCatholic = true;
            else rec.isSaintOrthodox = true;
        }
        byId.set(id, rec);
    }
    return byId;
}

type Marriage = { person: string; spouse: string; spouseLabel: string; start?: string; end?: string; spouseFamily?: string; spouseFamilyLabel?: string };

async function fetchMarriages(): Promise<Marriage[]> {
    const rows = await sparql(`
        SELECT ?person ?spouse ?spouseLabel ?start ?startPrecision ?end ?endPrecision ?spouseFamily ?spouseFamilyLabel WHERE {
            ?person wdt:P53 wd:${RURIKID_QID} .
            ?person p:P26 ?stmt .
            ?stmt ps:P26 ?spouse .
            OPTIONAL {
                ?stmt pqv:P580 ?startNode .
                ?startNode wikibase:timeValue ?start ; wikibase:timePrecision ?startPrecision .
            }
            OPTIONAL {
                ?stmt pqv:P582 ?endNode .
                ?endNode wikibase:timeValue ?end ; wikibase:timePrecision ?endPrecision .
            }
            OPTIONAL { ?spouse wdt:P53 ?spouseFamily }
            SERVICE wikibase:label { bd:serviceParam wikibase:language "ru,en". }
        }
    `);
    const byPair = new Map<string, Marriage>();
    for (const r of rows) {
        const key = [qid(r.person?.value), qid(r.spouse?.value)].sort().join("-");
        const rec: Marriage = byPair.get(key) ?? {
            person: qid(r.person?.value)!,
            spouse: qid(r.spouse?.value)!,
            spouseLabel: (r as any).spouseLabel?.value ?? qid(r.spouse?.value)!,
        };
        if (r.start && !rec.start) rec.start = formatWikidataDate(r.start.value, Number((r as any).startPrecision.value));
        if (r.end && !rec.end) rec.end = formatWikidataDate(r.end.value, Number((r as any).endPrecision.value));
        if (r.spouseFamily) {
            rec.spouseFamily = qid(r.spouseFamily.value);
            rec.spouseFamilyLabel = (r as any).spouseFamilyLabel?.value;
        }
        byPair.set(key, rec);
    }
    return [...byPair.values()];
}

type ChildRow = { person: string; child: string; childLabel: string; childFamily?: string; childFamilyLabel?: string };

async function fetchChildren(): Promise<ChildRow[]> {
    const rows = await sparql(`
        SELECT ?person ?child ?childLabel ?childFamily ?childFamilyLabel WHERE {
            ?person wdt:P53 wd:${RURIKID_QID} .
            ?person wdt:P40 ?child .
            OPTIONAL { ?child wdt:P53 ?childFamily }
            SERVICE wikibase:label { bd:serviceParam wikibase:language "ru,en". }
        }
    `);
    const byPair = new Map<string, ChildRow>();
    for (const r of rows) {
        const key = `${qid(r.person?.value)}-${qid(r.child?.value)}`;
        const rec: ChildRow = byPair.get(key) ?? {
            person: qid(r.person?.value)!,
            child: qid(r.child?.value)!,
            childLabel: (r as any).childLabel?.value ?? qid(r.child?.value)!,
        };
        if (r.childFamily) {
            rec.childFamily = qid(r.childFamily.value);
            rec.childFamilyLabel = (r as any).childFamilyLabel?.value;
        }
        byPair.set(key, rec);
    }
    return [...byPair.values()];
}

async function main() {
    console.log("Запрос A: княжеский ствол (P53 = Рюриковичи)...");
    const core = await fetchCore();
    console.log(`  -> ${core.size} персон`);
    await sleep(1500);

    console.log("Запрос B: браки...");
    const marriages = await fetchMarriages();
    console.log(`  -> ${marriages.length} пар`);
    await sleep(1500);

    console.log("Запрос C: дети...");
    const children = await fetchChildren();
    console.log(`  -> ${children.length} пар родитель-ребёнок`);

    const coreIds = new Set(core.keys());

    // Граничные персоны — супруги/дети вне ствола. Полной биографии не тянем (это следующий шаг,
    // если решим разворачивать конкретную ветку), только имя + свой род (для стыковки).
    type Boundary = { id: string; name: string; family?: string; familyLabel?: string };
    const boundary = new Map<string, Boundary>();
    for (const m of marriages) {
        if (!coreIds.has(m.spouse) && !boundary.has(m.spouse)) {
            boundary.set(m.spouse, { id: m.spouse, name: m.spouseLabel, family: m.spouseFamily, familyLabel: m.spouseFamilyLabel });
        }
    }
    for (const c of children) {
        if (!coreIds.has(c.child) && !boundary.has(c.child)) {
            boundary.set(c.child, { id: c.child, name: c.childLabel, family: c.childFamily, familyLabel: c.childFamilyLabel });
        }
    }

    // --- сопоставление со уже введёнными вручную записями nobles (без wikidataId — только по имени/датам) ---
    const db = await init();
    const existing = db.prepare(`select id, name, birthDate, deathDate from nobles`).all() as {
        id: number;
        name: string;
        birthDate: string | null;
        deathDate: string | null;
    }[];
    const existingByNormName = new Map<string, typeof existing>();
    for (const n of existing) {
        const key = normalizeName(n.name ?? "");
        if (!key) continue;
        existingByNormName.set(key, [...(existingByNormName.get(key) ?? []), n]);
    }

    // Совпадение по имени принимается ТОЛЬКО когда есть хоть одна подтверждающая дата (±3 года) —
    // без этого короткие/частые имена (особенно у граничных персон, для которых даты не тянем)
    // регулярно схлопывают РАЗНЫХ людей в одну запись. Проверено на практике: 4 разные "Анна"
    // без дат все указывали на единственную существующую "Анна" — вслепую принятое совпадение
    // потеряло бы 3 из 4 реальных персон. Лучше лишний раз завести новую запись, чем ошибочно слить.
    const findMatch = (name: string, birthYear?: number, deathYear?: number) => {
        const candidates = existingByNormName.get(normalizeName(name));
        if (!candidates || candidates.length === 0) return { matchedNobleId: null as number | null, matchConfidence: "new" as const };
        let best: (typeof existing)[number] | null = null;
        let bestScore = -1;
        for (const c of candidates) {
            const cBirth = extractYear(c.birthDate);
            const cDeath = extractYear(c.deathDate);
            let score = 0;
            if (birthYear !== undefined && cBirth !== undefined) score += Math.abs(birthYear - cBirth) <= 3 ? 2 : -2;
            if (deathYear !== undefined && cDeath !== undefined) score += Math.abs(deathYear - cDeath) <= 3 ? 2 : -2;
            if (score > bestScore) {
                bestScore = score;
                best = c;
            }
        }
        // bestScore <= 0 значит: либо нет ни одной даты для сверки (0), либо все сверенные даты
        // разошлись (отрицательный) — в обоих случаях совпадение не подтверждено, не гадаем.
        if (!best || bestScore <= 0) return { matchedNobleId: null as number | null, matchConfidence: "new" as const };
        return { matchedNobleId: best.id, matchConfidence: "fuzzy" as const };
    };

    const now = new Date().toISOString();
    const insertBatch = db.prepare(`insert into import_batches (source, label, createdAt) values (?, ?, ?)`);
    const insertStagingNoble = db.prepare(`
        insert into staging_nobles
            (batchId, wikidataId, name, birthDate, deathDate, birthDateMarker, deathDateMarker, gender,
             fatherWikidataId, motherWikidataId, familyWikidataId, isSaintOrthodox, isSaintCatholic, isBoundary, boundaryFamilyLabel,
             matchedNobleId, matchConfidence, status, raw)
        values (@batchId, @wikidataId, @name, @birthDate, @deathDate, @birthDateMarker, @deathDateMarker, @gender,
                @fatherWikidataId, @motherWikidataId, @familyWikidataId, @isSaintOrthodox, @isSaintCatholic, @isBoundary, @boundaryFamilyLabel,
                @matchedNobleId, @matchConfidence, 'pending', @raw)
    `);
    const insertStagingCouple = db.prepare(`
        insert into staging_couples (batchId, personWikidataId, spouseWikidataId, marriageDate, divorceDate, status)
        values (?, ?, ?, ?, ?, 'pending')
    `);
    const insertStagingFamily = db.prepare(`
        insert or ignore into staging_families (batchId, wikidataId, name, parentWikidataId, matchedFamilyId, status)
        values (?, ?, ?, ?, ?, 'pending')
    `);

    const existingFamilies = db.prepare(`select id, name from families`).all() as { id: number; name: string }[];
    const familyIdByNormName = new Map(existingFamilies.map((f) => [normalizeName(f.name ?? ""), f.id]));

    const run = db.transaction(() => {
        const batchId = insertBatch.run("wikidata", `Рюриковичи: ствол + граница, ${now.slice(0, 10)}`, now)
            .lastInsertRowid as number;

        insertStagingFamily.run(batchId, RURIKID_QID, "Рюриковичи", null, familyIdByNormName.get("рюриковичи") ?? null);

        let boundaryFamiliesInserted = 0;
        for (const b of boundary.values()) {
            if (!b.family) continue;
            insertStagingFamily.run(batchId, b.family, b.familyLabel ?? b.family, null, familyIdByNormName.get(normalizeName(b.familyLabel ?? "")) ?? null);
            boundaryFamiliesInserted++;
        }

        let newCount = 0;
        let fuzzyCount = 0;
        for (const p of core.values()) {
            const birthYear = p.birthYear;
            const deathYear = p.deathYear;
            const { matchedNobleId, matchConfidence } = findMatch(p.name, birthYear, deathYear);
            if (matchConfidence === "new") newCount++;
            else fuzzyCount++;
            insertStagingNoble.run({
                batchId,
                wikidataId: p.id,
                name: p.name,
                birthDate: p.birth ?? null,
                deathDate: p.death ?? null,
                // Числовой год для функции "современники" (contemporaries.ts сравнивает диапазоны
                // birthDateMarker/deathDateMarker) — заполняем всегда, когда есть хоть примерная дата,
                // даже если birthDate/deathDate текстом уточнить не можем.
                birthDateMarker: birthYear ?? null,
                deathDateMarker: deathYear ?? null,
                // В живой nobles.gender=1 означает мужской, 0 — женский (проверено на Игоре/Ольге) —
                // противоположно порядку male/female QID в Wikidata, поэтому маппинг инвертирован.
                gender: p.gender === GENDER_MALE ? 1 : p.gender === GENDER_FEMALE ? 0 : null,
                fatherWikidataId: p.father ?? null,
                motherWikidataId: p.mother ?? null,
                familyWikidataId: RURIKID_QID,
                isSaintOrthodox: p.isSaintOrthodox ? 1 : 0,
                isSaintCatholic: p.isSaintCatholic ? 1 : 0,
                isBoundary: 0,
                boundaryFamilyLabel: null,
                matchedNobleId,
                matchConfidence,
                raw: JSON.stringify({...p, canonizationLabels: [...p.canonizationLabels]}),
            });
        }

        let boundaryNew = 0;
        for (const b of boundary.values()) {
            const { matchedNobleId, matchConfidence } = findMatch(b.name);
            if (matchConfidence === "new") boundaryNew++;
            insertStagingNoble.run({
                batchId,
                wikidataId: b.id,
                name: b.name,
                birthDate: null,
                deathDate: null,
                birthDateMarker: null,
                deathDateMarker: null,
                gender: null,
                fatherWikidataId: null,
                motherWikidataId: null,
                familyWikidataId: b.family ?? null,
                isSaintOrthodox: 0,
                isSaintCatholic: 0,
                isBoundary: 1,
                boundaryFamilyLabel: b.familyLabel ?? null,
                matchedNobleId,
                matchConfidence,
                raw: JSON.stringify(b),
            });
        }

        for (const m of marriages) {
            insertStagingCouple.run(batchId, m.person, m.spouse, m.start ?? null, m.end ?? null);
        }

        // Подстраховка: даже с проверкой дат в findMatch несколько РАЗНЫХ Wikidata-персон изредка
        // могут набрать одинаковый score>0 против одной и той же существующей записи (омонимы с
        // похожими датами). Если для одной matchedNobleId в этой партии больше одного кандидата —
        // однозначного совпадения нет, снимаем сопоставление со всех (переводим в 'new'), чтобы не
        // гадать, какой из них "настоящий".
        const collidedGroups = db
            .prepare(
                `select matchedNobleId from staging_nobles
                 where batchId = ? and matchedNobleId is not null
                 group by matchedNobleId having count(*) > 1`,
            )
            .all(batchId) as {matchedNobleId: number}[];
        let collisionsResolved = 0;
        for (const g of collidedGroups) {
            const info = db
                .prepare(`update staging_nobles set matchedNobleId = null, matchConfidence = 'new' where batchId = ? and matchedNobleId = ?`)
                .run(batchId, g.matchedNobleId);
            collisionsResolved += info.changes;
        }

        return { batchId, newCount, fuzzyCount, boundaryNew, boundaryFamiliesInserted, collisionsResolved };
    });

    const result = run();

    console.log(`\n=== Готово: партия #${result.batchId} ===`);
    console.log(`Ствол: ${core.size} персон (${result.newCount} новых, ${result.fuzzyCount} с предложенным сопоставлением)`);
    console.log(`Граница: ${boundary.size} персон (${result.boundaryNew} без сопоставления)`);
    console.log(`Под-родов на границе с известным именем: ${result.boundaryFamiliesInserted}`);
    console.log(`Браков в staging: ${marriages.length}`);
    if (result.collisionsResolved > 0) {
        console.log(`Коллизий сопоставления снято (несколько кандидатов на одну запись): ${result.collisionsResolved}`);
    }
    console.log(`\nДальше — ревью в /admin/nobles/import/${result.batchId}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
