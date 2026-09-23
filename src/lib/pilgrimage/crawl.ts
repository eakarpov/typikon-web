// Обходчик сайтов храмов — чистая часть: robots.txt, ссылки на новости,
// дата публикации, упоминания святынь в тексте. Сеть, база и порядок обхода —
// в src/scripts/crawl-temple-sites.ts.
//
// ОБХОДЧИК НИЧЕГО НЕ ВНОСИТ В РЕЕСТР. Он находит страницы, где сказано о мощах,
// и кладёт их кандидатами на разбор: «ковчег с частицей мощей» в новости
// бывает и принесённым на три дня, и увезённым в прошлом году, и упомянутым в
// проповеди. Решает человек; обходчик только избавляет его от чтения тысячи
// сайтов подряд.
//
// Разбор регулярными выражениями, а не деревом документа: нужны текст, ссылки
// и пара метатегов, и ради этого не стоит тащить в зависимости разборщик HTML.

/**
 * Имя, под которым обходчик представляется, и страница, где сказано, кто он.
 * Только латиницей: заголовок HTTP кириллицы не допускает, и запрос с ней
 * не уходит вовсе.
 */
export const CRAWLER_NAME = "TypikonBot";
export const CRAWLER_UA = `${CRAWLER_NAME}/1.0 (+https://www.typikon.info/palomnichestvo#typikonbot; relics registry)`;

// ── robots.txt ───────────────────────────────────────────────────────────────

export interface RobotsRules { allow: string[]; disallow: string[]; crawlDelay: number | null; sitemaps: string[] }

/**
 * Правила для нас: группа, названная нашим именем, а если такой нет — общая
 * («*»). Смешивать группы нельзя — так велит и соглашение о robots.txt:
 * отдельная группа для обходчика целиком заменяет общую.
 */
export const parseRobots = (text: string, agent = CRAWLER_NAME): RobotsRules => {
    const groups: { agents: string[]; allow: string[]; disallow: string[]; delay: number | null }[] = [];
    const sitemaps: string[] = [];
    let current: (typeof groups)[number] | null = null;
    let lastWasAgent = false;

    for (const raw of text.split(/\r?\n/)) {
        const line = raw.replace(/#.*$/, "").trim();
        const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
        if (!m) continue;
        const key = m[1].toLowerCase();
        const value = m[2].trim();
        if (key === "sitemap") { if (value) sitemaps.push(value); continue; }
        if (key === "user-agent") {
            if (!current || !lastWasAgent) { current = { agents: [], allow: [], disallow: [], delay: null }; groups.push(current); }
            current.agents.push(value.toLowerCase());
            lastWasAgent = true;
            continue;
        }
        lastWasAgent = false;
        if (!current) continue;
        if (key === "allow" && value) current.allow.push(value);
        else if (key === "disallow" && value) current.disallow.push(value);
        else if (key === "crawl-delay") {
            const d = Number(value.replace(",", "."));
            if (Number.isFinite(d) && d >= 0) current.delay = d;
        }
    }

    const name = agent.toLowerCase();
    const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && name.includes(a)));
    const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
    return {
        allow: chosen.flatMap((g) => g.allow),
        disallow: chosen.flatMap((g) => g.disallow),
        crawlDelay: chosen.map((g) => g.delay).find((d) => d !== null) ?? null,
        sitemaps,
    };
};

/** Правило robots.txt как выражение: «*» — что угодно, «$» в конце — конец адреса. */
const ruleMatches = (rule: string, path: string) => {
    const anchored = rule.endsWith("$");
    const body = (anchored ? rule.slice(0, -1) : rule)
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
};

/** Можно ли нам по этому пути. Побеждает самое длинное совпавшее правило; при равенстве — разрешение. */
export const robotsAllows = (rules: RobotsRules, path: string): boolean => {
    let best: { len: number; allow: boolean } | null = null;
    for (const [list, allow] of [[rules.allow, true], [rules.disallow, false]] as const) {
        for (const rule of list) {
            if (!ruleMatches(rule, path)) continue;
            const len = rule.length;
            if (!best || len > best.len || (len === best.len && allow)) best = { len, allow };
        }
    }
    return best ? best.allow : true;
};

// ── Адреса ──────────────────────────────────────────────────────────────────

/** Сайты, где у храма страница, а не сайт: их не обходим — ни новостей по-нашему, ни разрешения. */
const SOCIAL = /(^|\.)(vk\.com|vkontakte\.ru|ok\.ru|youtube\.com|youtu\.be|facebook\.com|instagram\.com|t\.me|telegram\.me|twitter\.com|x\.com|google\.com|goo\.gl|yandex\.ru|wikipedia\.org|wikimapia\.org|dzen\.ru|livejournal\.com|mail\.ru)$/i;

/** Адрес сайта из поля каталога: только http(s), без чужих соцсетей; null — не обходим. */
export const siteOf = (raw: string): URL | null => {
    let s = (raw ?? "").trim();
    if (!s) return null;
    // Схема названа — принимаем только http(s); не названа — это голое имя сайта.
    if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) return null;
    if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
    try {
        const u = new URL(s);
        if (u.protocol !== "http:" && u.protocol !== "https:") return null;
        if (u.username || u.password) return null;
        if (SOCIAL.test(u.hostname)) return null;
        return u;
    } catch {
        return null;
    }
};

/**
 * Адрес, ходить по которому нельзя: локальный, частной сети, служебный.
 * Сайты храмов взяты из открытых данных, и запись вида http://127.0.0.1:8767
 * отправила бы обходчик на сервере в нашу же службу устава.
 */
export const isPrivateAddress = (ip: string): boolean => {
    const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
    if (v4) {
        const [a, b] = [Number(v4[1]), Number(v4[2])];
        return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
            || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
    }
    const v6 = ip.toLowerCase();
    if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
    return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
};

/** Тот же сайт: хост совпадает с точностью до «www.». */
export const sameSite = (a: URL, b: URL) => a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "");

const ASSET = /\.(jpe?g|png|gif|webp|svg|ico|pdf|docx?|xlsx?|pptx?|zip|rar|7z|mp3|mp4|avi|mov|css|js|xml|rss|txt)(\?|$)/i;

/** Слова, по которым ссылка ведёт в новости: адрес или подпись. */
const NEWSY = /(news|novost|новост|sobyt|событ|anons|анонс|obyavl|объявл|zhizn|жизнь|blog|блог|archive|архив|stati|стать|chronic|летопис|hronik|хроник)/i;

export interface Link { url: string; text: string }

const decode = (s: string) => s
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&laquo;/g, "«").replace(/&raquo;/g, "»")
    .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

/** Ссылки страницы на тот же сайт, без картинок и файлов, без якорей. */
export const linksOf = (html: string, base: URL): Link[] => {
    const out = new Map<string, Link>();
    for (const m of html.matchAll(/<a\b[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi)) {
        const href = decode(m[1] ?? m[2] ?? m[3] ?? "");
        if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
        let u: URL;
        try { u = new URL(href, base); } catch { continue; }
        if (!/^https?:$/.test(u.protocol) || !sameSite(u, base) || ASSET.test(u.pathname)) continue;
        u.hash = "";
        const text = decode(m[4].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
        if (!out.has(u.href)) out.set(u.href, { url: u.href, text });
    }
    return [...out.values()];
};

/** Разделы новостей на главной: по адресу или подписи ссылки. */
export const newsSections = (links: Link[], base: URL): string[] =>
    links.filter((l) => {
        const path = new URL(l.url).pathname;
        return path !== "/" && path !== base.pathname && (NEWSY.test(path) || NEWSY.test(l.text));
    }).map((l) => l.url).slice(0, 4);

/**
 * Статьи раздела: ссылки глубже самого раздела — «/news/123», «/news/2026/…» под
 * «/news/». Порядок сохраняется: разделы почти везде начинаются с новых.
 */
export const articlesOf = (links: Link[], section: URL): string[] => {
    const prefix = section.pathname.replace(/\/?$/, "/");
    return links
        .map((l) => new URL(l.url))
        .filter((u) => u.pathname.startsWith(prefix) && u.pathname.length > prefix.length + 1
            && !/[?&](page|PAGEN_\d+|start)=/i.test(u.search) && !/\/page\/\d+\/?$/.test(u.pathname))
        .map((u) => u.href);
};

/** Адреса из карты сайта, кроме файлов; вложенные карты — отдельно. */
export const sitemapLocs = (xml: string): { pages: { url: string; lastmod: string | null }[]; nested: string[] } => {
    const pages: { url: string; lastmod: string | null }[] = [];
    const nested: string[] = [];
    const isIndex = /<sitemapindex\b/i.test(xml);
    for (const m of xml.matchAll(/<(url|sitemap)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
        const loc = /<loc>\s*([^<]+?)\s*<\/loc>/i.exec(m[2])?.[1];
        if (!loc) continue;
        const url = decode(loc);
        if (isIndex || m[1].toLowerCase() === "sitemap") { nested.push(url); continue; }
        if (ASSET.test(url)) continue;
        pages.push({ url, lastmod: /<lastmod>\s*([^<]+?)\s*<\/lastmod>/i.exec(m[2])?.[1] ?? null });
    }
    return { pages, nested };
};

// ── Текст и дата ─────────────────────────────────────────────────────────────

/** Видимый текст страницы: без скриптов, стилей, меню и подвала — насколько это видно по тегам. */
export const textOf = (html: string): string => decode(html
    .replace(/<(head|script|style|noscript|svg|template|nav|footer|header)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|p|div|li|h[1-6]|tr|section|article)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

export const titleOf = (html: string): string | null => {
    const og = /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1];
    const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1];
    const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
    const raw = og ?? h1 ?? title;
    return raw ? decode(raw.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 300) : null;
};

export const MONTHS_GEN: Record<string, number> = {
    января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6,
    июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
};
const MONTH_RX = Object.keys(MONTHS_GEN).join("|");

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number): string | null => {
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null;
};

/**
 * Дата публикации. По убыванию надёжности: метатеги статьи, разметка
 * schema.org, `<time datetime>`, дата в адресе, первая дата в начале текста.
 * Последнее — догадка, и разбирающий видит дату рядом с отрывком.
 */
export const publishedOf = (html: string, url: string): string | null => {
    const meta = /<meta[^>]+(?:property|name|itemprop)=["'](?:article:published_time|datePublished|pubdate|date)["'][^>]*content=["'](\d{4})-(\d{2})-(\d{2})/i.exec(html)
        ?? /"datePublished"\s*:\s*"(\d{4})-(\d{2})-(\d{2})/i.exec(html)
        ?? /<time[^>]+datetime=["'](\d{4})-(\d{2})-(\d{2})/i.exec(html);
    if (meta) return iso(Number(meta[1]), Number(meta[2]), Number(meta[3]));

    const inUrl = /\/(20\d{2})[/-](\d{1,2})[/-](\d{1,2})(?:\/|-|$)/.exec(new URL(url).pathname);
    if (inUrl) return iso(Number(inUrl[1]), Number(inUrl[2]), Number(inUrl[3]));

    const head = textOf(html).slice(0, 3000);
    const dotted = /\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/.exec(head);
    const worded = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_RX})\\s+(20\\d{2})`, "i").exec(head);
    const first = [dotted && { at: dotted.index, v: iso(Number(dotted[3]), Number(dotted[2]), Number(dotted[1])) },
        worded && { at: worded.index, v: iso(Number(worded[3]), MONTHS_GEN[worded[2].toLowerCase()], Number(worded[1])) }]
        .filter(Boolean).sort((a, b) => a!.at - b!.at)[0];
    return first?.v ?? null;
};

// ── Упоминания святынь ──────────────────────────────────────────────────────

export type GuessKind = "moshchi" | "glava" | "chastitsa" | "raka";
export type GuessState = "present" | "visiting" | null;

export interface Mention {
    snippet: string;
    kind: GuessKind;
    state: GuessState;
    /** Дни пребывания, если в отрывке названы: «с 5 по 12 октября». */
    visit: { from: string; to: string } | null;
    /** Кто — как написано в тексте, в родительном падеже: «святителя Николая Чудотворца». */
    saintGuess: string | null;
}

// Буквы — явным классом: \w и \b в JavaScript знают одну латиницу, и
// «мощ\w*» кириллического окончания не видит.
const L = "[а-яё]";
const NOT_L = "(?![а-яё])";
const RELIC = new RegExp(`(ковчег${L}*|частиц${L}*\\s+(?:св\\.\\s*|святых\\s+|честных\\s+)?мощ${L}*|честн${L}*\\s+глав${L}*|мощ(?:и|ей|ам|ами|ах)${NOT_L}|рак${L}*\\s+с\\s+мощ${L}*)`, "gi");

const VISITING = /(принесен|принесён|доставлен|привезен|привезён|прибыва|прибуд|пребыва|пребуд|будет\s+находить|будут\s+находить|для\s+поклонения|можно\s+будет\s+поклон|до\s+\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря))/i;
const PRESENT = /(почива|покоятся|покоится|хранится|хранятся|находится\s+(?:ковчег|частиц|рак)|находятся\s+(?:мощи|частиц)|в\s+(?:нашем|этом)\s+храме\s+(?:есть|находится|хранится))/i;

/** Звания святых в родительном падеже — ими начинается «чьи мощи». */
const TITLE = "(?:святител[а-яё]*|свт\\.|преподобн[а-яё]*|прп\\.|преподобномуч[а-яё]*|великомучени[а-яё]*|вмч\\.|вмц\\.|мучени[а-яё]*|мч\\.|мц\\.|священномучени[а-яё]*|сщмч\\.|свщмч\\.|блаженн[а-яё]*|блж\\.|праведн[а-яё]*|прав\\.|равноапостольн[а-яё]*|равноап\\.|апостол[а-яё]*|ап\\.|пророк[а-яё]*|страстотерп[а-яё]*|благоверн[а-яё]*|блгв\\.|исповедник[а-яё]*|новомученик[а-яё]*|великого|великой|князя|княгини|царя|царицы|царевича|царевны|святого|святой|святых|свят[а-яё]*|св\\.)";
const SAINT = new RegExp(`(?:${TITLE}\\s+)+(?:[А-ЯЁ][а-яё\\-]+|[а-яё]+(?:ого|ой))(?:\\s+(?:[А-ЯЁ][а-яё\\-]+|[а-яё]+(?:ского|цкого|ого|ой)))${"{0,3}"}`);

const kindOf = (s: string): GuessKind => {
    const l = s.toLowerCase();
    if (/ковчег|частиц/.test(l)) return "chastitsa";
    if (/глав/.test(l)) return "glava";
    if (/рак/.test(l)) return "raka";
    return "moshchi";
};

/** «с 5 по 12 октября», «с 28 сентября по 3 октября», «5–12 октября»: дни пребывания в году публикации. */
export const visitOf = (text: string, year: number): { from: string; to: string } | null => {
    const rx = new RegExp(`(?:с\\s+)?(\\d{1,2})(?:\\s+(${MONTH_RX}))?\\s*(?:по|–|—|-|до)\\s*(\\d{1,2})\\s+(${MONTH_RX})`, "i");
    const m = rx.exec(text);
    if (!m) return null;
    const toMonth = MONTHS_GEN[m[4].toLowerCase()];
    const fromMonth = m[2] ? MONTHS_GEN[m[2].toLowerCase()] : toMonth;
    // Через Новый год: «с 28 декабря по 5 января» — конец уже в следующем году.
    const toYear = fromMonth > toMonth ? year + 1 : year;
    const from = iso(year, fromMonth, Number(m[1]));
    const to = iso(toYear, toMonth, Number(m[3]));
    return from && to && from <= to ? { from, to } : null;
};

/**
 * Упоминания святынь в тексте: отрывок вокруг, вид, догадка о состоянии и о
 * святом. Одинаковые отрывки сводятся; больше пяти с одной страницы не берём —
 * это уже не новость о святыне, а, скорее, житие или проповедь.
 */
export const mentionsOf = (text: string, published: string | null): Mention[] => {
    const year = published ? Number(published.slice(0, 4)) : new Date().getUTCFullYear();
    const out: Mention[] = [];
    const seen = new Set<string>();
    for (const m of text.matchAll(RELIC)) {
        const at = m.index ?? 0;
        const start = Math.max(0, text.lastIndexOf("\n", Math.max(0, at - 1)) + 1, at - 220);
        const endLine = text.indexOf("\n", at + m[0].length);
        const end = Math.min(text.length, endLine < 0 ? text.length : endLine, at + m[0].length + 260);
        const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
        if (seen.has(snippet)) continue;
        seen.add(snippet);
        // Святого ищем до конца строки, а не на фиксированную длину: «святителя
        // Николая Чудотворца» не должен обрываться на полуслове.
        const lineEnd = text.indexOf("\n", at);
        const after = text.slice(at, lineEnd < 0 ? text.length : Math.min(lineEnd, at + 400));
        const saint = SAINT.exec(after);
        const visit = visitOf(snippet, year);
        out.push({
            snippet,
            kind: kindOf(m[0]),
            state: VISITING.test(snippet) || visit ? "visiting" : PRESENT.test(snippet) ? "present" : null,
            visit,
            saintGuess: saint ? saint[0].replace(/\s+/g, " ").trim() : null,
        });
        if (out.length >= 5) break;
    }
    return out;
};

/**
 * Упоминание, ради которого страницу стоит показать человеку. Одно слово
 * «мощи» без глагола пребывания и без святого — чаще житие, тропарь или
 * расписание («молебен у мощей» в монастыре, где они давно известны).
 */
export const isWorthReview = (m: Mention) => m.state !== null || m.saintGuess !== null;

/** Основы имён из догадки — для поиска святого в каталоге: «Сергия Радонежского» → «серги», «радонежск». */
export const nameStems = (guess: string): string[] =>
    (guess.match(/[А-ЯЁ][а-яё-]+/g) ?? [])
        .map((w) => w.toLowerCase().replace(/ё/g, "е").replace(/(ого|его|ая|яя|ия|ея|ой|ей|ца|ы|а|я|и)$/, ""))
        .filter((w) => w.length >= 3)
        .slice(0, 3);

/**
 * Приведение для сличения: без ударений и титл, «ё» как «е», строчными.
 * Снимаются только знаки ударения и титла, а не всё надстрочное подряд: через
 * разложение NFD «й» распалась бы на «и» с бреве и потеряла его.
 */
export const plain = (s: string) => s.normalize("NFC")
    .replace(/[̀́̑҃-҉]/g, "")
    .replace(/ѐ/g, "е").replace(/ѝ/g, "и")
    .toLowerCase().replace(/ё/g, "е");
