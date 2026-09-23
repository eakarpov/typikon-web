import "@/scripts/lib/env";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import clientPromise from "@/lib/mongodb";
import { filterOf } from "@/lib/temples";
import { CRAWLER_UA, matchSaints, plain } from "@/lib/pilgrimage/crawl";
import {
    AZBYKA_API, AZBYKA_CATEGORIES, locationOf, pageUrl, placeKindOf, relicsOf, whereStems,
} from "@/lib/pilgrimage/azbyka";
import { loadSaintIndex, upsertCandidate, type CandidateInput } from "@/lib/pilgrimage/candidates";

// Постоянные святыни из «Азбуки паломника»: строки раздела «Святыни» страниц
// храмов и обителей — кандидатами на разбор в /admin/relics, с храмом каталога,
// найденным по координатам страницы. В реестр не пишет ничего.
//
// Страницы берутся API вики пачками по пятьдесят вместе с текстом — это около
// двухсот запросов на всю Россию, с паузой между ними; обходить вёрстку не нужно.
//
// Запуск:
//   npm run relics:azbyka                         # показать, ничего не писать
//   npm run relics:azbyka -- --limit 200          # первые двести страниц
//   npm run relics:azbyka -- --write              # записать находки
// Ключи: --delay 2 (секунды между запросами), --json файл.json

const arg = (name: string, fallback?: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback;
};
const WRITE = process.argv.includes("--write");
const LIMIT = Number(arg("limit", "0")) || Infinity;
const DELAY_MS = 1000 * Math.max(1, Number(arg("delay", "2")) || 2);
const JSON_OUT = arg("json");

/** Храм каталога ищем не дальше этого от точки страницы: у обители храмы разбросаны по стенам. */
const NEAR_M = 1500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface WikiPage { title: string; text: string; touched: string | null }

/**
 * Запрос к API вики с повтором: редкий ответ задерживается больше минуты, и
 * одна такая задержка не должна обрывать прогон по девяти тысячам страниц.
 * Пауза перед повтором растёт — сервер, которому тяжело, не добиваем.
 */
const askWiki = async (params: URLSearchParams): Promise<any> => {
    for (let attempt = 1; ; attempt++) {
        try {
            const res = await fetch(`${AZBYKA_API}?${params}`, {
                headers: { "User-Agent": CRAWLER_UA }, signal: AbortSignal.timeout(90_000),
            });
            if (res.ok) return await res.json();
            if (res.status < 500 && res.status !== 429) throw new Error(`API ответил ${res.status}`);
            if (attempt >= 3) throw new Error(`API ответил ${res.status}`);
        } catch (e) {
            if (attempt >= 3) throw e;
            console.log(`  повтор ${attempt}: ${String((e as Error).message ?? e)}`);
        }
        await sleep(DELAY_MS * 5 * attempt);
    }
};

/** Страницы категории вместе с текстом — пачками, пока вики говорит «ещё». */
async function* pagesOf(category: string): AsyncGenerator<WikiPage> {
    let cont: Record<string, string> = {};
    for (;;) {
        const params = new URLSearchParams({
            action: "query", format: "json", formatversion: "2",
            // По двадцать пять: пачка в полсотни отвечает в семь раз дольше (замер
            // 2026-09-23: 1,1 с против 7,9 с), и растут редкие минутные задержки.
            generator: "categorymembers", gcmtitle: category, gcmlimit: "25", gcmnamespace: "0",
            prop: "revisions", rvprop: "content|timestamp", rvslots: "main",
            ...cont,
        });
        const json = await askWiki(params);
        for (const p of json.query?.pages ?? []) {
            const rev = p.revisions?.[0];
            const text = rev?.slots?.main?.content;
            if (typeof text === "string") yield { title: p.title, text, touched: rev.timestamp ?? null };
        }
        if (!json.continue) return;
        cont = json.continue;
        await sleep(DELAY_MS);
    }
}

/** Слова имени без служебных — для сличения названия страницы и храма каталога. */
const words = (s: string) => new Set(plain(s).split(/[^а-я]+/)
    .filter((w) => w.length >= 4 && !/^(храм|церк|собор|монаст|обител|свято|святы|мужск|женск|приходск)/.test(w))
    .map((w) => w.slice(0, 6)));

const main = async () => {
    const client = await clientPromise;
    const temples = client.db("typikon").collection("temples");
    const saints = await loadSaintIndex();

    /**
     * Храмы каталога у точки страницы, по порядку уместности: сперва тот, чьё
     * имя называет уточнение строки («в Троицком соборе»), затем совпавшие с
     * названием страницы, затем ближайшие.
     */
    const templesNear = async (lat: number, lon: number, title: string, where: string | null) => {
        const rows = await temples.aggregate([
            { $geoNear: {
                near: { type: "Point", coordinates: [lon, lat] }, distanceField: "distance",
                maxDistance: NEAR_M, spherical: true, query: filterOf({}),
            } },
            { $limit: 15 },
            { $project: { _id: 0, slug: 1, name: 1, distance: 1 } },
        ]).toArray();
        const stems = whereStems(where);
        const titleWords = words(title);
        const score = (t: any) => {
            const name = plain(t.name);
            const byWhere = stems.length && stems.every((s) => name.includes(s)) ? 2 : 0;
            const byTitle = [...words(t.name)].filter((w) => titleWords.has(w)).length ? 1 : 0;
            return byWhere + byTitle - t.distance / NEAR_M;
        };
        return rows.sort((a, b) => score(b) - score(a)).slice(0, 3).map((t) => t.slug as string);
    };

    const found: CandidateInput[] = [];
    let pages = 0, withSection = 0, noPoint = 0, former = 0, nameless = 0;

    outer:
    for (const category of AZBYKA_CATEGORIES) {
        for await (const page of pagesOf(category)) {
            if (pages >= LIMIT) break outer;
            pages++;
            const relics = relicsOf(page.text);
            if (!relics.length) continue;
            withSection++;
            const point = locationOf(page.text);
            if (!point) noPoint++;
            const url = pageUrl(page.title);
            for (const r of relics) {
                // Прежнее место святыни — не то, куда ехать; в очередь его не ставим.
                if (r.former) { former++; continue; }
                // Без святого запись реестра не оформить: «мощевики», «ковчег с
                // мощами 25-ти угодников» — святыни, но не этого реестра.
                if (!r.saintGuess) { nameless++; continue; }
                const templeSlugs = point ? await templesNear(point.lat, point.lon, page.title, r.where) : [];
                // Ключ находки — страница и строка: на одной странице десяток святынь.
                const key = createHash("sha1").update(`${r.line}\u0000${r.saintGuess}`).digest("hex").slice(0, 10);
                found.push({
                    url: `${url}#${key}`,
                    site: "azbyka.ru/palomnik",
                    templeSlugs,
                    title: `${page.title}${placeKindOf(page.text) ? ` — ${placeKindOf(page.text)}` : ""}`,
                    published: page.touched?.slice(0, 10) ?? null,
                    mentions: [{ snippet: r.line, kind: r.kind, state: "present", visit: null, saintGuess: r.saintGuess }],
                    kind: r.kind,
                    state: "present",
                    visit: null,
                    saintGuess: r.saintGuess,
                    saintCandidates: matchSaints(r.saintGuess, saints, `${page.title} ${r.context}`),
                    origin: "azbyka",
                    where: r.where,
                });
            }
            if (pages % 250 === 0) console.log(`  …страниц ${pages}, с разделом «Святыни» ${withSection}, находок ${found.length}`);
        }
    }

    const matchedTemple = found.filter((c) => c.templeSlugs.length).length;
    const matchedSaint = found.filter((c) => c.saintCandidates.length === 1).length;
    console.log(`страниц ${pages}; с мощами в разделе «Святыни» ${withSection} (без координат ${noPoint}); `
        + `находок ${found.length}; пропущено: прежних мест ${former}, без святого ${nameless}`);
    console.log(`храм каталога найден у ${matchedTemple}, святой однозначно — у ${matchedSaint}`);
    for (const c of found.slice(0, 15)) {
        console.log(`  • ${c.mentions[0].snippet}\n    ${c.title} → ${c.templeSlugs[0] ?? "храм не найден"}`
            + `${c.saintCandidates.length ? ` · ${c.saintCandidates.map((s) => s.name).join("; ")}` : ""}`);
    }

    if (WRITE) {
        for (const c of found) await upsertCandidate(c);
        console.log(`записано находок: ${found.length}`);
    } else {
        console.log("холостой прогон — ничего не записано; --write запишет");
    }
    if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(found, null, 2));
    process.exit(0);
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
