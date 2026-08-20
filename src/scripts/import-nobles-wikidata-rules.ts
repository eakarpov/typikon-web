// Тянет из Wikidata P39 (position held) для ствола Рюриковичей — княжеские/царские титулы с датами
// начала/конца — и раскладывает в staging_rules на ревью в /admin/nobles/import. P39 в Wikidata
// используется для ЛЮБых должностей (директор школы, аббатиса и т.п.), поэтому вместо allowlist-фильтра
// используется прямой словарь "текст титула -> государственность": если титул не нашёлся в словаре,
// строка просто отбрасывается — это не престол, а случайная нецарская должность конкретной персоны.
//
// Запуск: npm run nobles:import-wikidata-rules
import "@/scripts/lib/env";
import { init } from "@/lib/sqlite";
import { formatWikidataDate } from "@/scripts/lib/wikidataDate";

const ENDPOINT = "https://query.wikidata.org/sparql";
const UA = "typikon-web/1.0 (nobles import script, contact: georgecarpow@gmail.com)";
const RURIKID_QID = "Q210398";

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
const normalizeTitle = (label: string) =>
    label
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[^a-zа-я ]/gi, "")
        .replace(/\s+/g, " ")
        .trim();

// Ключ — нормализованный текст титула из P39, как он реально встречается в данных (см. разведку
// в чате: полный список меток и их частот у ствола Рюриковичей). Значение — id в states.
// Не-монархические/консортские/нецарские метки (посадник, регент, аббатиса, царевич и т.п.)
// намеренно не включены — такие строки просто не найдут пары и будут пропущены.
const TITLE_TO_STATE: Record<string, number> = {
    "великий князь киевский": 2,
    "князь киевский": 1,
    "князь черниговский": 11,
    "великий князь новгородский": 3,
    "князь новгородский": 3,
    "великий князь московский": 30,
    "князь полоцкий": 6,
    "великий князь владимирский": 29,
    "царь всея руси": 31,
    "государь всея руси": 30, // титул Ивана III/Василия III — ещё московский, до венчания на царство 1547 г.
    "брянский князь": 33,
    "князь брянский": 33,
    "великий князь смоленский": 13,
    "князь смоленский": 13,
    "князь ростовский": 8,
    "князь туровский": 5,
    "князь тверской": 32,
    "великий князь тверской": 32,
    "князья муромские": 9,
    "князь муромский": 9,
    "князь переяславский": 20,
    "князь переяславльский": 20,
    "король польский": 16,
};

type PositionRow = {
    person: string;
    positionLabel: string;
    start?: string;
    end?: string;
};

async function fetchPositions(): Promise<PositionRow[]> {
    const rows = await sparql(`
        SELECT ?person ?positionLabel ?start ?startPrecision ?end ?endPrecision WHERE {
            ?person wdt:P53 wd:${RURIKID_QID} .
            ?person p:P39 ?stmt .
            ?stmt ps:P39 ?position .
            OPTIONAL {
                ?stmt pqv:P580 ?startNode .
                ?startNode wikibase:timeValue ?start ; wikibase:timePrecision ?startPrecision .
            }
            OPTIONAL {
                ?stmt pqv:P582 ?endNode .
                ?endNode wikibase:timeValue ?end ; wikibase:timePrecision ?endPrecision .
            }
            SERVICE wikibase:label { bd:serviceParam wikibase:language "ru,en". }
        }
    `);
    return rows.map((r) => ({
        person: qid(r.person?.value)!,
        positionLabel: (r as any).positionLabel?.value ?? "",
        start: r.start ? formatWikidataDate(r.start.value, Number((r as any).startPrecision.value)) : undefined,
        end: r.end ? formatWikidataDate(r.end.value, Number((r as any).endPrecision.value)) : undefined,
    }));
}

async function main() {
    console.log("Запрос: P39 (position held) для ствола Рюриковичей...");
    const positions = await fetchPositions();
    console.log(`  -> ${positions.length} записей`);

    const db = await init();

    const nobleByWid = new Map(
        (db.prepare(`select id, wikidataId from nobles where wikidataId is not null`).all() as any[]).map((r) => [
            r.wikidataId,
            r.id,
        ]),
    );

    const existingRules = db.prepare(`select id, personId, stateId, startDate, endDate from rules`).all() as {
        id: number;
        personId: number;
        stateId: number;
        startDate: string | null;
        endDate: string | null;
    }[];
    const existingByPersonState = new Map<string, (typeof existingRules)[number][]>();
    for (const r of existingRules) {
        const key = `${r.personId}-${r.stateId}`;
        existingByPersonState.set(key, [...(existingByPersonState.get(key) ?? []), r]);
    }

    const now = new Date().toISOString();
    const insertBatch = db.prepare(`insert into import_batches (source, label, createdAt) values (?, ?, ?)`);
    const insertStagingRule = db.prepare(`
        insert into staging_rules (batchId, personWikidataId, stateId, title, startDate, endDate, rawPositionLabel, matchedRuleId, status)
        values (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);

    let matched = 0;
    let unmatchedLabel = 0;
    let personNotMerged = 0;
    let alreadyCovered = 0;
    const unmatchedLabels = new Map<string, number>();

    const run = db.transaction(() => {
        const batchId = insertBatch.run("wikidata-rules", `Рюриковичи: правления, ${now.slice(0, 10)}`, now)
            .lastInsertRowid as number;

        for (const p of positions) {
            const stateId = TITLE_TO_STATE[normalizeTitle(p.positionLabel)];
            if (!stateId) {
                unmatchedLabel++;
                unmatchedLabels.set(p.positionLabel, (unmatchedLabels.get(p.positionLabel) ?? 0) + 1);
                continue;
            }
            const personId = nobleByWid.get(p.person);
            if (!personId) {
                personNotMerged++;
                continue;
            }
            matched++;

            const candidates = existingByPersonState.get(`${personId}-${stateId}`) ?? [];
            let matchedRuleId: number | null = null;
            if (candidates.length > 0) {
                alreadyCovered++;
                matchedRuleId = candidates[0].id;
            }

            // Важно: title = реальная метка из Wikidata (p.positionLabel), а НЕ обратный поиск по
            // словарю TITLE_TO_STATE. У одной державности бывает несколько разных настоящих титулов
            // (Московское: "великий князь Московский" И "Государь всея Руси") — обратный поиск всегда
            // возвращал бы только первый попавшийся ключ словаря, из-за чего две персоны с разными
            // титулами на одну державность выглядели бы как один и тот же титул и были неотличимы
            // при последующей сверке/дозаполнении дат.
            const title = p.positionLabel;
            insertStagingRule.run(batchId, p.person, stateId, title ?? null, p.start ?? null, p.end ?? null, p.positionLabel, matchedRuleId);
        }

        return batchId;
    });

    const batchId = run();

    console.log(`\n=== Готово: партия #${batchId} ===`);
    console.log(`Найдено в словаре государственностей: ${matched}`);
    console.log(`  из них уже покрыто существующей записью в rules (на сверку): ${alreadyCovered}`);
    console.log(`Персона ещё не смержена (отложено до следующего прогона): ${personNotMerged}`);
    console.log(`Не найдено в словаре (не престол / нецарская должность): ${unmatchedLabel}`);
    if (unmatchedLabels.size > 0) {
        console.log(`  метки без пары (топ-15):`);
        for (const [label, count] of [...unmatchedLabels.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
            console.log(`    ${count}x "${label}"`);
        }
    }
    console.log(`\nДальше — ревью в /admin/nobles/import/${batchId}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
