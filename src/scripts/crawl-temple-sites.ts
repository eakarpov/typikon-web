import "@/scripts/lib/env";
import { lookup } from "node:dns/promises";
import { writeFileSync } from "node:fs";
import clientPromise from "@/lib/mongodb";
import { filterOf } from "@/lib/temples";
import {
    articlesOf, CRAWLER_UA, isPrivateAddress, isWorthReview, linksOf, mentionsOf, nameStems, newsSections,
    parseRobots, plain, publishedOf, robotsAllows, siteOf, sitemapLocs, textOf, titleOf, type RobotsRules,
} from "@/lib/pilgrimage/crawl";
import { recentlyCrawled, recordCrawl, upsertCandidate, type CandidateInput } from "@/lib/pilgrimage/candidates";

// Обходчик сайтов храмов: ищет новости о святынях и кладёт их кандидатами на
// разбор в /admin/relics. В реестр не пишет ничего (см. @/lib/pilgrimage/crawl).
//
// ВЕЖЛИВОСТЬ — УСЛОВИЕ, А НЕ ЛЮБЕЗНОСТЬ. Приходские сайты живут на дешёвых
// хостингах, и обходчик, пришедший сотней запросов в минуту, для них — отказ в
// обслуживании. Поэтому:
//   * robots.txt соблюдается, Crawl-delay тоже (до 30 с); robots.txt, ответивший
//     ошибкой сервера, значит «сюда нельзя», а не «можно всё»;
//   * к одному сайту — один запрос за раз и не чаще раза в --delay секунд;
//   * не больше --pages страниц с сайта; страница больше полутора мегабайт
//     обрезается;
//   * представляемся своим именем и адресом страницы, где сказано, кто мы.
//
// БЕЗОПАСНОСТЬ. Адреса сайтов взяты из открытых данных. Прежде каждого запроса,
// и на каждом шаге перенаправления, имя сайта разрешается и сверяется: частные
// и локальные адреса запрещены — иначе запись каталога вида
// http://127.0.0.1:8767 отправила бы обходчик на сервере в нашу службу устава.
//
// ГДЕ ЗАПУСКАТЬ. Находки ложатся в typikon-users той базы, что в окружении: на
// сервере — в рабочую, откуда их видит /admin/relics. Локальный прогон годится
// для проверки (без --write ничего не пишет, --json кладёт находки в файл).
//
// Запуск:
//   npm run relics:crawl -- --limit 5                 # пять сайтов, только показать
//   npm run relics:crawl -- --site https://hram.ru    # один сайт
//   npm run relics:crawl -- --country RU --write      # записать находки
// Ключи: --pages 25, --delay 3, --concurrency 4, --recrawl-days 30, --force,
//        --json файл.json

const arg = (name: string, fallback?: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

const WRITE = flag("write");
const FORCE = flag("force");
const LIMIT = Number(arg("limit", "0")) || Infinity;
const PAGES = Math.min(100, Number(arg("pages", "25")) || 25);
const DELAY_S = Math.max(1, Number(arg("delay", "3")) || 3);
const CONCURRENCY = Math.min(8, Math.max(1, Number(arg("concurrency", "4")) || 4));
const RECRAWL_DAYS = Number(arg("recrawl-days", "30"));
const COUNTRIES = arg("country")?.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
const ONLY_SITE = arg("site");
const JSON_OUT = arg("json");
/** Только для проверки на своей машине: пускает к localhost и ни к каким иным частным адресам. */
const ALLOW_LOCAL = flag("allow-local");

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 15_000;
const MAX_CRAWL_DELAY_S = 30;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Сеть ─────────────────────────────────────────────────────────────────────

class Refused extends Error {}

const checkedHosts = new Map<string, boolean>();

/** Хост разрешается и проверяется один раз: ни один из его адресов не должен быть частным. */
const hostIsPublic = async (hostname: string): Promise<boolean> => {
    if (ALLOW_LOCAL && (hostname === "localhost" || hostname === "127.0.0.1")) return true;
    if (checkedHosts.has(hostname)) return checkedHosts.get(hostname)!;
    let ok = false;
    try {
        const addrs = await lookup(hostname, { all: true });
        ok = addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address));
    } catch { ok = false; }
    checkedHosts.set(hostname, ok);
    return ok;
};

/** Кодировка ответа: из заголовка, из <meta> в начале документа, иначе UTF-8. */
const charsetOf = (contentType: string | null, head: Buffer): string => {
    const fromHeader = /charset=([\w-]+)/i.exec(contentType ?? "")?.[1];
    const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head.toString("latin1"))?.[1];
    const label = (fromHeader ?? fromMeta ?? "utf-8").toLowerCase();
    try { new TextDecoder(label); return label; } catch { return "utf-8"; }
};

interface Fetched { url: URL; status: number; body: string; contentType: string }

/**
 * Запрос с ручными перенаправлениями: каждый шаг проверяется так же, как
 * первый. Тело читается не больше MAX_BYTES — остальное обрывается.
 */
const get = async (start: URL, accept = "text/html,application/xhtml+xml"): Promise<Fetched> => {
    let url = start;
    for (let hop = 0; hop < 5; hop++) {
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Refused(`схема ${url.protocol}`);
        if (url.port && !["80", "443", "8080"].includes(url.port) && !ALLOW_LOCAL) throw new Refused(`порт ${url.port}`);
        if (!(await hostIsPublic(url.hostname))) throw new Refused(`частный или неразрешимый адрес: ${url.hostname}`);

        const res = await fetch(url, {
            redirect: "manual",
            signal: AbortSignal.timeout(TIMEOUT_MS),
            headers: { "User-Agent": CRAWLER_UA, Accept: accept, "Accept-Language": "ru,en;q=0.5" },
        });
        if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
            url = new URL(res.headers.get("location")!, url);
            await res.body?.cancel();
            continue;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        if (res.body) {
            const reader = res.body.getReader();
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(Buffer.from(value));
                size += value.length;
                if (size >= MAX_BYTES) { await reader.cancel(); break; }
            }
        }
        const raw = Buffer.concat(chunks);
        const contentType = res.headers.get("content-type") ?? "";
        const body = new TextDecoder(charsetOf(contentType, raw.subarray(0, 2048))).decode(raw);
        return { url, status: res.status, body, contentType };
    }
    throw new Refused("слишком много перенаправлений");
};

// ── Сайт ─────────────────────────────────────────────────────────────────────

interface Site { key: string; home: URL; templeSlugs: string[]; country: string | null }

interface SiteResult {
    site: string;
    outcome: "ok" | "robots" | "refused" | "error";
    note?: string;
    pages: number;
    candidates: CandidateInput[];
}

/** Святые каталога для сличения догадок: имя и прочие имена, приведённые. */
type SaintRow = { dneslovId: string; name: string; slug: string | null; hay: string };

const matchSaints = (guess: string | null, saints: SaintRow[]) => {
    if (!guess) return [];
    const stems = nameStems(guess);
    if (!stems.length) return [];
    return saints
        .filter((s) => stems.every((stem) => s.hay.includes(stem)))
        .slice(0, 5)
        .map(({ dneslovId, name, slug }) => ({ dneslovId, name, slug }));
};

const crawlSite = async (site: Site, saints: SaintRow[]): Promise<SiteResult> => {
    const result: SiteResult = { site: site.key, outcome: "ok", pages: 0, candidates: [] };
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
    const queue: string[] = [site.home.href];
    let origin = site.home;

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

    // Главная и разделы — прежде всего списки ссылок, и подпись «Принесение
    // ковчега» там — лишь заголовок той же статьи, которую мы сейчас откроем.
    // Находкой список становится только при святом или днях пребывания в самом
    // отрывке: так бывает, когда объявление стоит прямо на главной.
    const examine = (page: Fetched, listing = false) => {
        const published = publishedOf(page.body, page.url.href);
        const mentions = mentionsOf(textOf(page.body), published)
            .filter((m) => listing ? !!(m.saintGuess || m.visit) : isWorthReview(m));
        if (!mentions.length) return;
        const best = mentions.find((m) => m.state === "visiting") ?? mentions.find((m) => m.saintGuess) ?? mentions[0];
        const saintGuess = mentions.map((m) => m.saintGuess).find(Boolean) ?? null;
        result.candidates.push({
            url: page.url.href, site: site.key, templeSlugs: site.templeSlugs,
            title: titleOf(page.body), published, mentions,
            // Сводка по всей странице, а не по одному отрывку: в заголовке сказано
            // «принесение ковчега», а дни пребывания — строкой ниже.
            kind: best.kind,
            state: mentions.some((m) => m.state === "visiting") ? "visiting"
                : mentions.some((m) => m.state === "present") ? "present" : null,
            visit: mentions.map((m) => m.visit).find(Boolean) ?? null,
            saintGuess, saintCandidates: matchSaints(saintGuess, saints),
        });
    };

    // Главная: и сама бывает лентой новостей, и из неё видно, где разделы.
    const home = await fetchPage(queue[0]);
    if (!home) return { ...result, outcome: "error", note: "главная не открылась" };
    origin = home.url;
    examine(home, true);

    // Разделы новостей и статьи в них — по порядку, как их ставит сайт: почти
    // везде сперва свежее.
    const sections = newsSections(linksOf(home.body, origin), origin);
    const articles: string[] = [];
    for (const section of sections) {
        if (result.pages >= PAGES) break;
        const page = await fetchPage(section);
        if (!page) continue;
        examine(page, true);
        articles.push(...articlesOf(linksOf(page.body, page.url), page.url).slice(0, PAGES));
    }

    // Карта сайта — если статей из разделов не набралось: берём свежие адреса.
    if (articles.length < PAGES / 2) {
        const maps = rules.sitemaps.length ? rules.sitemaps.slice(0, 2) : [new URL("/sitemap.xml", origin).href];
        for (const map of maps) {
            try {
                const u = new URL(map);
                if (!robotsAllows(rules, u.pathname)) continue;
                await sleep(delay);
                const xml = await get(u, "application/xml,text/xml");
                if (xml.status >= 400) continue;
                const { pages, nested } = sitemapLocs(xml.body);
                let locs = pages;
                if (!locs.length && nested[0]) {
                    await sleep(delay);
                    const inner = await get(new URL(nested[nested.length - 1]), "application/xml,text/xml");
                    locs = sitemapLocs(inner.body).pages;
                }
                articles.push(...locs
                    .filter((l) => /news|novost|новост|sobyt|событ|anons|blog|stat/i.test(l.url))
                    .sort((a, b) => (b.lastmod ?? "").localeCompare(a.lastmod ?? ""))
                    .map((l) => l.url)
                    .slice(0, PAGES));
            } catch { /* карты нет — обойдёмся разделами */ }
        }
    }

    for (const href of articles) {
        if (result.pages >= PAGES) break;
        try { if (!new URL(href).hostname.endsWith(origin.hostname.replace(/^www\./, ""))) continue; } catch { continue; }
        const page = await fetchPage(href);
        if (page) examine(page);
    }
    return result;
};

// ── Порядок обхода ───────────────────────────────────────────────────────────

const main = async () => {
    const client = await clientPromise;
    const temples = await client.db("typikon").collection("temples").find(
        { ...filterOf({}), website: { $type: "string", $ne: "" }, ...(COUNTRIES ? { country: { $in: COUNTRIES } } : {}) },
        { projection: { _id: 0, slug: 1, website: 1, country: 1 } },
    ).toArray();

    // Сайт один на несколько храмов бывает часто — у обители и её подворий. Обходим
    // его один раз, а находку относим ко всем его храмам: какой из них — решит человек.
    const sites = new Map<string, Site>();
    let skippedSocial = 0;
    for (const t of temples) {
        const home = siteOf(t.website);
        if (!home) { skippedSocial++; continue; }
        const key = home.hostname.replace(/^www\./, "") + home.pathname.replace(/\/+$/, "");
        if (ONLY_SITE && siteOf(ONLY_SITE)?.hostname.replace(/^www\./, "") !== home.hostname.replace(/^www\./, "")) continue;
        const site: Site = sites.get(key) ?? { key, home, templeSlugs: [], country: t.country ?? null };
        site.templeSlugs.push(t.slug);
        sites.set(key, site);
    }

    // Сайт, названный ключом, но не записанный ни за одним храмом, обходим как
    // есть: так проверяют обходчик на новом сайте прежде, чем вносить его в каталог.
    if (ONLY_SITE && !sites.size) {
        const home = siteOf(ONLY_SITE);
        if (!home) throw new Error(`не сайт: ${ONLY_SITE}`);
        sites.set(home.host, { key: home.host, home, templeSlugs: [], country: null });
    }

    const recent = FORCE || ONLY_SITE ? new Set<string>() : await recentlyCrawled(new Date(Date.now() - RECRAWL_DAYS * 86400000));
    const todo = [...sites.values()].filter((s) => !recent.has(s.key)).slice(0, LIMIT);

    const saints: SaintRow[] = (await client.db("typikon").collection("saints")
        .find({}, { projection: { _id: 0, name: 1, altNames: 1, slug: 1, externals: 1 } }).toArray())
        .map((s: any) => ({
            dneslovId: String((s.externals ?? []).find((e: any) => e.source === "dneslov")?.id ?? ""),
            name: s.name, slug: s.slug ?? null,
            hay: plain([s.name, ...(s.altNames ?? [])].join(" ")),
        }))
        .filter((s) => s.dneslovId);

    console.log(`храмов с сайтом: ${temples.length}; сайтов: ${sites.size}; соцсети и прочее пропущено: ${skippedSocial}`);
    console.log(`обойдено недавно (${RECRAWL_DAYS} дн.): ${recent.size}; к обходу: ${todo.length}`
        + `; ${WRITE ? "находки ЗАПИСЫВАЮТСЯ" : "холостой прогон — ничего не пишется"}`);

    const results: SiteResult[] = [];
    let next = 0;
    const worker = async () => {
        while (next < todo.length) {
            const site = todo[next++];
            let r: SiteResult;
            try {
                r = await crawlSite(site, saints);
            } catch (e) {
                r = { site: site.key, outcome: "error", note: String((e as Error).message ?? e), pages: 0, candidates: [] };
            }
            results.push(r);
            console.log(`${r.outcome.padEnd(7)} ${site.key}  страниц ${r.pages}, находок ${r.candidates.length}${r.note ? ` — ${r.note}` : ""}`);
            for (const c of r.candidates) {
                console.log(`   • ${c.published ?? "без даты"}  ${c.url}`);
                console.log(`     ${c.mentions[0].snippet.slice(0, 200)}`);
                if (c.saintGuess) console.log(`     святой: ${c.saintGuess}${c.saintCandidates.length ? ` → ${c.saintCandidates.map((s) => s.name).join("; ")}` : ""}`);
            }
            if (WRITE) {
                for (const c of r.candidates) await upsertCandidate(c);
                await recordCrawl(r.site, { outcome: r.outcome, note: r.note ?? null, pages: r.pages, found: r.candidates.length });
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));

    const by = (o: SiteResult["outcome"]) => results.filter((r) => r.outcome === o).length;
    const found = results.reduce((n, r) => n + r.candidates.length, 0);
    console.log(`\nитого: обойдено ${by("ok")}, запрещено robots.txt ${by("robots")}, отказано ${by("refused")}, `
        + `ошибок ${by("error")}; страниц ${results.reduce((n, r) => n + r.pages, 0)}; находок ${found}`);
    if (JSON_OUT) {
        writeFileSync(JSON_OUT, JSON.stringify(results, null, 2));
        console.log(`находки записаны в ${JSON_OUT}`);
    }
    process.exit(0);
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
