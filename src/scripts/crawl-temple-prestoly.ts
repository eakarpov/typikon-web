import "@/scripts/lib/env";
import { writeFileSync } from "node:fs";
import clientPromise from "@/lib/mongodb";
import { filterOf } from "@/lib/temples";
import {
    aboutSections, inSiteScope, linksOf, newsSections, parseRobots, robotsAllows, sameSite, siteOf, textOf, type RobotsRules,
} from "@/lib/pilgrimage/crawl";
import { TEMPLE_SOURCES } from "@/utils/templeSources";
import { createFetcher, Refused, type Fetched } from "@/lib/pilgrimage/net";
import { thronesOfText, type PrestolGuess } from "@/lib/pilgrimage/prestoly";

// Обходчик сайтов храмов: читает рассказ прихода о себе и выписывает ПРЕСТОЛЫ,
// которых не назвало имя храма. Найденное ложится престолом со статусом
// `pending` и с отрывком — в `temples.prestoly` (см. @/lib/pilgrimage/prestoly).
//
// ЗАЧЕМ ОТДЕЛЬНО ОТ СВЯТЫНЬ. Обходчик новостей (@/scripts/crawl-temple-sites)
// ищет в лентах мощи и кладёт находки кандидатами в `typikon-users`: святыня —
// запись реестра, живёт отдельно от храма. Престол же — свойство самого храма:
// он стоит в `temples.prestoly`, и его читают и карточка, и устав. Поэтому
// находка идёт туда, где престолу и место.
//
// ПОЧЕМУ ЛОЖИТСЯ ПРЕДЛОЖЕНИЕМ. Разбор прозы ошибается чаще разбора имени, и
// статус `pending` — та же граница, что у имён: показывать и отдавать уставу
// можно только выверенное человеком (`approved`). Престолы, помеченные руками
// (`approved`), обходчик не трогает вовсе: правка человека старше догадки.
//
// ГДЕ ЗАПУСКАТЬ. Там, где готовят корпус (как `temples:match`): `typikon.temples`
// уезжает на сервер дампом (@/scripts/release-db.sh), и запись из обхода доедет
// до читателя только так. Ключ `--write` пишет, без него — только показывает.
//
// Запуск:
//   npm run temples:crawl-prestoly -- --limit 5          # пять сайтов, только показать
//   npm run temples:crawl-prestoly -- --site https://hram.ru
//   npm run temples:crawl-prestoly -- --country RU --write
// Ключи: --pages 12, --delay 3, --concurrency 4, --recrawl-days 90, --force,
//        --json файл.json

const arg = (name: string, fallback?: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

const WRITE = flag("write");
const FORCE = flag("force");
const LIMIT = Number(arg("limit", "0")) || Infinity;
const PAGES = Math.min(40, Number(arg("pages", "12")) || 12);
const DELAY_S = Math.max(1, Number(arg("delay", "3")) || 3);
const CONCURRENCY = Math.min(8, Math.max(1, Number(arg("concurrency", "4")) || 4));
const RECRAWL_DAYS = Number(arg("recrawl-days", "90"));
const COUNTRIES = arg("country")?.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
const ONLY_SITE = arg("site");
const JSON_OUT = arg("json");
const ALLOW_LOCAL = flag("allow-local");

const MAX_CRAWL_DELAY_S = 30;

// Своды с условием «только ссылка» (sobory.ru, temples.ru, days.pravoslavie.ru)
// обходить нельзя: там чужой труд, и мы даём на них ссылку, а не берём данные.
const LINK_ONLY_HOSTS = new Set(
    TEMPLE_SOURCES.filter((s) => s.policy === "link" && s.url).map((s) => {
        try { return new URL(s.url).hostname.replace(/^www\./, ""); } catch { return ""; }
    }).filter(Boolean),
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Сеть, вежливость и безопасность — те же, что у обходчика святынь.
const { get } = createFetcher({ allowLocal: ALLOW_LOCAL });

// ── Сайт ─────────────────────────────────────────────────────────────────────

interface Site { key: string; home: URL; templeSlugs: string[]; country: string | null; gap: number }

/** Престол-находка с местом, откуда он взят. */
interface Found extends PrestolGuess { url: string }

interface SiteResult {
    site: string;
    outcome: "ok" | "robots" | "refused" | "error";
    note?: string;
    pages: number;
    thrones: Found[];
}

/** Свести престолы нескольких страниц одного сайта: один престол — одна запись. */
const mergeFound = (into: Map<string, Found>, guesses: PrestolGuess[], url: string) => {
    for (const g of guesses) {
        const prev = into.get(g.dedication);
        if (!prev) { into.set(g.dedication, { ...g, url }); continue; }
        prev.isMain = prev.isMain || g.isMain;
        if (g.tier === "pattern") { prev.tier = "pattern"; prev.pattern = g.pattern; }
        prev.confidence = Math.max(prev.confidence, g.confidence);
    }
};

const crawlSite = async (site: Site): Promise<SiteResult> => {
    const result: SiteResult = { site: site.key, outcome: "ok", pages: 0, thrones: [] };
    let rules: RobotsRules = { allow: [], disallow: [], crawlDelay: null, sitemaps: [] };

    try {
        const robots = await get(new URL("/robots.txt", site.home), "text/plain");
        if (robots.status >= 500) return { ...result, outcome: "robots", note: `robots.txt ответил ${robots.status}` };
        if (robots.status < 400) rules = parseRobots(robots.body);
    } catch (e) {
        if (e instanceof Refused) return { ...result, outcome: "refused", note: e.message };
        return { ...result, outcome: "error", note: `robots.txt: ${String((e as Error).message ?? e)}` };
    }
    if (!robotsAllows(rules, site.home.pathname || "/")) return { ...result, outcome: "robots", note: "robots.txt запрещает" };

    const delay = 1000 * Math.min(MAX_CRAWL_DELAY_S, Math.max(DELAY_S, rules.crawlDelay ?? 0));
    const seen = new Set<string>();
    const found = new Map<string, Found>();

    const fetchPage = async (href: string): Promise<Fetched | null> => {
        const u = new URL(href);
        if (seen.has(u.href) || !robotsAllows(rules, u.pathname + u.search)) return null;
        seen.add(u.href);
        if (result.pages > 0) await sleep(delay);
        result.pages++;
        try {
            const page = await get(u);
            if (page.status >= 400 || !/html/i.test(page.contentType)) return null;
            return page;
        } catch {
            return null;
        }
    };

    const examine = (page: Fetched) => mergeFound(found, thronesOfText(textOf(page.body)), page.url.href);

    const home = await fetchPage(site.home.href);
    if (!home) return { ...result, outcome: "error", note: "главная не открылась" };
    // Заглушки на дешёвых платформах уводят на чужой хост (общую страницу
    // платформы, карту храмов). Это уже не сайт храма: разбирать там нечего.
    if (!sameSite(home.url, site.home)) {
        return { ...result, outcome: "refused", note: `перенаправление на чужой хост: ${home.url.hostname}` };
    }

    const links = linksOf(home.body, home.url);
    // Только свои страницы: у храма на общей площадке соседний подкаталог —
    // это чужой храм, и его престол нам не принадлежит.
    const aboutLinks = aboutSections(links, home.url).filter((href) => inSiteScope(home.url, new URL(href)));
    const newsLinks = newsSections(links, home.url);

    // У сайтов на дешёвых CMS главная — лента новостей, и престолы в ней
    // тонут среди чужих храмов и «престолов Божиих». Поэтому читаем рассказ
    // о храме, а главную — лишь когда сайт не новостной: у малой приходской
    // страницы рассказ и есть главная.
    for (const href of aboutLinks) {
        if (result.pages >= PAGES) break;
        const page = await fetchPage(href);
        if (page) examine(page);
    }
    if (!found.size && !newsLinks.length) examine(home);

    result.thrones = [...found.values()];
    if (!aboutLinks.length && newsLinks.length) {
        return { ...result, note: "страницы о храме нет — только новости" };
    }
    return result;
};

// ── Порядок обхода ───────────────────────────────────────────────────────────

const main = async () => {
    const client = await clientPromise;
    const db = client.db("typikon");
    const users = client.db("typikon-users");
    const temples = db.collection("temples");

    const rows = await temples.find(
        { ...filterOf({}), website: { $type: "string", $ne: "" }, ...(COUNTRIES ? { country: { $in: COUNTRIES } } : {}) },
        { projection: { _id: 0, slug: 1, name: 1, website: 1, country: 1, prestoly: 1 } },
    ).toArray();

    // Сайт один на несколько храмов бывает часто — у обители и её подворий.
    // Обходим его один раз: престолы сайта — всем его храмам.
    const sites = new Map<string, Site>();
    let skippedSocial = 0;
    let skippedLink = 0;
    for (const t of rows as any[]) {
        const home = siteOf(t.website);
        if (!home) { skippedSocial++; continue; }
        if (LINK_ONLY_HOSTS.has(home.hostname.replace(/^www\./, ""))) { skippedLink++; continue; }
        if (ONLY_SITE && siteOf(ONLY_SITE)?.hostname.replace(/^www\./, "") !== home.hostname.replace(/^www\./, "")) continue;
        const key = home.hostname.replace(/^www\./, "") + home.pathname.replace(/\/+$/, "");
        const site: Site = sites.get(key) ?? { key, home, templeSlugs: [], country: t.country ?? null, gap: 99 };
        site.templeSlugs.push(t.slug);
        // Чего у храма меньше всего — то и обходим первым: у храма без престола
        // находка дороже, чем у храма с тремя.
        site.gap = Math.min(site.gap, (t.prestoly?.length ?? 0));
        sites.set(key, site);
    }
    if (ONLY_SITE && !sites.size) {
        const home = siteOf(ONLY_SITE);
        if (!home) throw new Error(`не сайт: ${ONLY_SITE}`);
        if (LINK_ONLY_HOSTS.has(home.hostname.replace(/^www\./, ""))) {
            throw new Error(`свод с условием «только ссылка»: ${home.hostname}`);
        }
        sites.set(home.host, { key: home.host, home, templeSlugs: [], country: null, gap: 99 });
    }

    // Журнал обхода — в typikon-users: корпус накатывается дампом с --drop и
    // стёр бы его, а журнал нужен между прогонами.
    const journal = users.collection("prestolCrawl");
    const since = new Date(Date.now() - RECRAWL_DAYS * 86400000);
    const recent = FORCE || ONLY_SITE ? new Set<string>()
        : new Set((await journal.find({ lastCrawledAt: { $gte: since } }, { projection: { site: 1 } }).toArray()).map((r) => r.site as string));

    const todo = [...sites.values()]
        .filter((s) => !recent.has(s.key))
        .sort((a, b) => a.gap - b.gap || a.key.localeCompare(b.key))
        .slice(0, LIMIT);

    const dedBySlug = new Map((await db.collection("dedications").find({}).toArray()).map((d: any) => [d.slug, d]));

    console.log(`храмов с сайтом: ${rows.length}; сайтов: ${sites.size}; соцсети и прочее пропущено: ${skippedSocial}`
        + `; своды-ссылки пропущены: ${skippedLink}`);
    console.log(`обойдено недавно (${RECRAWL_DAYS} дн.): ${recent.size}; к обходу: ${todo.length}`
        + `; ${WRITE ? "найденное ЗАПИСЫВАЕТСЯ" : "холостой прогон — ничего не пишется"}`);

    const results: SiteResult[] = [];
    let next = 0;
    const worker = async () => {
        while (next < todo.length) {
            const site = todo[next++];
            let r: SiteResult;
            try {
                r = await crawlSite(site);
            } catch (e) {
                r = { site: site.key, outcome: "error", note: String((e as Error).message ?? e), pages: 0, thrones: [] };
            }
            results.push(r);
            console.log(`${r.outcome.padEnd(7)} ${site.key}  страниц ${r.pages}, престолов ${r.thrones.length}${r.note ? ` — ${r.note}` : ""}`);
            for (const t of r.thrones) {
                console.log(`   • ${t.isMain ? "главный" : "придел"}  ${t.label}  (${t.tier}, ${t.confidence})`);
                console.log(`     ${t.url}`);
                console.log(`     ${t.phrase.slice(0, 200)}`);
            }
            if (WRITE) {
                for (const slug of site.templeSlugs) await applyThrones(temples, slug, r.thrones, dedBySlug);
                // Ошибку сети в журнал не пишем: она временная, и повторный
                // прогон должен сходить на сайт снова, а не пропустить его на
                // 90 дней. Запрет robots и частный адрес — другое дело.
                if (r.outcome !== "error") {
                    await journal.updateOne({ site: r.site }, {
                        $set: { site: r.site, outcome: r.outcome, note: r.note ?? null, pages: r.pages, found: r.thrones.length, lastCrawledAt: new Date() },
                    }, { upsert: true });
                }
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));

    const by = (o: SiteResult["outcome"]) => results.filter((r) => r.outcome === o).length;
    const total = results.reduce((n, r) => n + r.thrones.length, 0);
    const withFound = results.filter((r) => r.thrones.length).length;
    console.log(`\nитого: обойдено ${by("ok")}, запрещено robots.txt ${by("robots")}, отказано ${by("refused")}, `
        + `ошибок ${by("error")}; страниц ${results.reduce((n, r) => n + r.pages, 0)}; `
        + `престолов ${total} на ${withFound} сайтах`);
    if (JSON_OUT) {
        writeFileSync(JSON_OUT, JSON.stringify(results, null, 2));
        console.log(`найденное записано в ${JSON_OUT}`);
    }
    process.exit(0);
};

/**
 * Дописать найденные престолы храму. Уже названные (из имени или прочим
 * обходом) не трогаем: повторный прогон не должен их размножать. Главный у
 * храма один — если он уже есть, находка становится приделом и ждёт человека.
 */
const applyThrones = async (
    temples: any, slug: string, thrones: Found[], dedBySlug: Map<string, any>,
) => {
    if (!thrones.length) return;
    const t = await temples.findOne({ slug }, { projection: { prestoly: 1 } });
    if (!t) return;
    const existing = t.prestoly ?? [];
    // Выверенное человеком не трогаем.
    if (existing.some((p: any) => p.status === "approved")) return;

    const have = new Set(existing.map((p: any) => p.dedication));
    let hasMain = existing.some((p: any) => p.isMain);
    const add: any[] = [];
    const now = new Date();
    for (const g of thrones) {
        if (have.has(g.dedication)) continue;
        const dedication = dedBySlug.get(g.dedication);
        const isMain = g.isMain && !hasMain;
        if (isMain) hasMain = true;
        add.push({
            dedication: g.dedication,
            label: g.label,
            isMain,
            kind: g.kind,
            memoryIds: (dedication?.feasts ?? []).map((f: any) => f.memoryId).filter(Boolean),
            source: "site",
            status: "pending",
            tier: g.tier,
            pattern: g.pattern,
            confidence: g.confidence,
            evidence: { url: g.url, phrase: g.phrase },
            matchedAt: now,
        });
    }
    if (!add.length) return;
    await temples.updateOne({ slug }, { $set: { prestoly: [...existing, ...add] } });
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
