// Сопоставляет канонизированных Рюриковичей (nobles.isSaintOrthodox/isSaintCatholic) с записями
// dneslov.org — идентичности святых в проекте нет, она целиком живёт на dneslov.org (см. /saints/[id]).
//
// Первая версия искала кандидатов только среди уже загруженных на сайт текстов (texts.name в Mongo) —
// это давало 0 совпадений для персон, на которых пока просто нет текста в самой typikon-базе (Ольга,
// Игорь и т.д., хотя на dneslov.org они точно есть). Эта версия ходит на dneslov.org напрямую: у сайта
// есть собственный поиск (index.json?q=...), через него дневслов ищем каждого канонизированного noble'а
// по имени/церковному имени, сверяем по году (как и в импорте из Wikidata — без подтверждения не
// гадаем) и кладём в staging_dneslov_links на ревью.
//
// Запуск: npm run nobles:link-dneslov
import "@/scripts/lib/env";
import { init } from "@/lib/sqlite";
import { normalizeName, extractYear, containsWord } from "@/scripts/lib/textNormalize";
import { Agent, fetch as undiciFetch } from "undici";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) typikon-web/1.0 (contact: georgecarpow@gmail.com)";

// dneslov.org отдаёт неполную цепочку сертификатов (UNABLE_TO_VERIFY_LEAF_SIGNATURE у Node, хотя curl
// через системный кейчейн проходит) — тот же случай, что уже задокументирован и обойдён в
// @/scripts/lib/dneslov.ts (DNESLOV_INSECURE_TLS). Само соединение вдобавок нестабильно само по себе
// (не только сертификат) — нужны ретраи независимо от TLS.
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

type SearchResult = {
    id: number;
    title?: string;
    base_year?: number;
    event_title?: string;
};

// Реальный поисковый эндпоинт сайта (подсмотрен в devtools при наборе в поле "Что ищем?" на
// dneslov.org) — c=рпц,днес это те же два календаря, что выбраны по умолчанию в самом интерфейсе.
async function searchDneslov(query: string, retries = 4): Promise<SearchResult[]> {
    const url = `https://dneslov.org/index.json?c=${encodeURIComponent("рпц,днес")}&q=${encodeURIComponent(query)}&p=1`;
    try {
        const res = await undiciFetch(url, {
            headers: {
                "User-Agent": UA,
                Accept: "application/json, text/plain, */*",
                Referer: "https://dneslov.org/",
                "X-Requested-With": "XMLHttpRequest",
            },
            dispatcher: insecureAgent,
            signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as {list?: SearchResult[]};
        return data.list ?? [];
    } catch (e) {
        if (retries <= 0) {
            console.warn(`  поиск "${query}" не удался, пропускаю: ${e}`);
            return [];
        }
        await sleep(1500);
        return searchDneslov(query, retries - 1);
    }
}

type Noble = {
    id: number;
    name: string;
    churchName: string | null;
    nickName: string | null;
    birthDateMarker: number | null;
    deathDateMarker: number | null;
};

async function main() {
    const db = await init();
    const nobles = db
        .prepare(
            `select id, name, churchName, nickName, birthDateMarker, deathDateMarker
             from nobles
             where (isSaintOrthodox = 1 or isSaintCatholic = 1) and (dneslovId is null or dneslovId = '')`,
        )
        .all() as Noble[];
    console.log(`Канонизированных без dneslovId: ${nobles.length}`);

    const now = new Date().toISOString();
    const insertBatch = db.prepare(`insert into import_batches (source, label, createdAt) values (?, ?, ?)`);
    const insertLink = db.prepare(`
        insert into staging_dneslov_links (batchId, nobleId, dneslovId, matchedName, matchedYearDate, confidence, status)
        values (?, ?, ?, ?, ?, ?, 'pending')
    `);

    let confirmed = 0;
    let nameOnly = 0;
    let searched = 0;
    let withResults = 0;

    const batchId = insertBatch.run("dneslov", `Рюриковичи: связь со святыми (dneslov), ${now.slice(0, 10)}`, now)
        .lastInsertRowid as number;

    for (const n of nobles) {
        // Ищем и по светскому, и по церковному имени по отдельности — dneslov часто озаглавливает
        // память церковным именем (Ольга -> "во Святом Крещении Елена"), а не мирским.
        const queries = [n.name, n.churchName].filter(Boolean) as string[];
        const resultsById = new Map<number, SearchResult>();
        for (const q of queries) {
            const results = await searchDneslov(q);
            for (const r of results) resultsById.set(r.id, r);
            await sleep(900);
        }
        searched++;
        if (searched % 10 === 0) console.log(`  ...${searched}/${nobles.length}`);
        if (resultsById.size === 0) continue;
        withResults++;

        const nameTargets = [n.name, n.churchName, ...(n.nickName ? n.nickName.split(/[,;]/) : [])]
            .filter(Boolean)
            .map((s) => normalizeName(s as string));

        for (const r of resultsById.values()) {
            if (!r.title) continue;
            const normTitle = normalizeName(r.title);
            // Заголовок памяти — не чистое имя, а описательная фраза ("великий князь Игорь ...
            // Черниговский и Киевский") — считаем совпадением, если он СОДЕРЖИТ нормализованное
            // имя/церковное имя/прозвище noble'а целиком.
            const nameMatches = nameTargets.some((t) => t && containsWord(normTitle, t));
            if (!nameMatches) continue;

            const targetYear = extractYear(String(r.base_year ?? ""));
            const yearMatches =
                targetYear !== undefined &&
                ((n.birthDateMarker && Math.abs(targetYear - n.birthDateMarker) <= 3) ||
                    (n.deathDateMarker && Math.abs(targetYear - n.deathDateMarker) <= 3));

            // Имя совпало (это уже был наш собственный поисковый запрос) — "confirmed" когда вдобавок
            // подтвердился год; без даты для сверки оставляем "name-only" на ручную проверку.
            const confidence = yearMatches ? "confirmed" : "name-only";
            if (confidence === "confirmed") confirmed++;
            else nameOnly++;

            insertLink.run(batchId, n.id, String(r.id), r.title, r.base_year != null ? String(r.base_year) : null, confidence);
        }
    }

    console.log(`\n=== Готово: партия #${batchId} ===`);
    console.log(`Персон с результатами поиска: ${withResults} из ${nobles.length}`);
    console.log(`Подтверждено именем+годом: ${confirmed}`);
    console.log(`Только по имени (без сверки датой): ${nameOnly}`);
    console.log(`\nДальше — ревью в /admin/nobles/import/${batchId}`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
