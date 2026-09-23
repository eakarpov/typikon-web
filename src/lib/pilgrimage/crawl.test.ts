import { test } from "node:test";
import assert from "node:assert/strict";
import {
    articlesOf, CRAWLER_UA, isPrivateAddress, isWorthReview, linksOf, matchSaints, mentionsOf, nameStems, newsSections,
    parseRobots, plain, publishedOf, robotsAllows, siteOf, sitemapLocs, textOf, visitOf,
} from "./crawl";

test("robots.txt: своя группа заменяет общую", () => {
    const txt = "User-agent: *\nDisallow: /\n\nUser-agent: TypikonBot\nDisallow: /admin\nCrawl-delay: 10\nSitemap: https://h.ru/sitemap.xml";
    const r = parseRobots(txt);
    assert.equal(robotsAllows(r, "/news/1"), true);
    assert.equal(robotsAllows(r, "/admin/x"), false);
    assert.equal(r.crawlDelay, 10);
    assert.deepEqual(r.sitemaps, ["https://h.ru/sitemap.xml"]);
});

test("robots.txt: запрет всего для всех — нельзя никуда", () => {
    const r = parseRobots("User-agent: *\nDisallow: /");
    assert.equal(robotsAllows(r, "/"), false);
    assert.equal(robotsAllows(r, "/news"), false);
});

test("robots.txt: длиннейшее правило, шаблоны и конец адреса", () => {
    const r = parseRobots("User-agent: *\nDisallow: /news/\nAllow: /news/public/\nDisallow: /*.php$\nDisallow: /*?print=");
    assert.equal(robotsAllows(r, "/news/1"), false);
    assert.equal(robotsAllows(r, "/news/public/2"), true);
    assert.equal(robotsAllows(r, "/index.php"), false);
    assert.equal(robotsAllows(r, "/index.php?id=1"), true);
    assert.equal(robotsAllows(r, "/a?print=1"), false);
    assert.equal(robotsAllows(parseRobots(""), "/что-угодно"), true);
});

test("robots.txt: несколько имён в одной группе", () => {
    const r = parseRobots("User-agent: Googlebot\nUser-agent: *\nDisallow: /private");
    assert.equal(robotsAllows(r, "/private/1"), false);
});

test("сайт каталога: соцсети и не-http не обходим", () => {
    assert.equal(siteOf("https://vk.com/hram"), null);
    assert.equal(siteOf("https://www.youtube.com/watch?v=1"), null);
    assert.equal(siteOf("ftp://hram.ru"), null);
    assert.equal(siteOf("hram.ru")?.href, "http://hram.ru/");
    assert.equal(siteOf("https://user:pw@hram.ru"), null);
});

test("частные адреса запрещены", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.1", "172.20.0.1", "169.254.1.1", "0.0.0.0", "::1", "fd00::1", "::ffff:127.0.0.1", "100.64.0.1"]) {
        assert.equal(isPrivateAddress(ip), true, ip);
    }
    for (const ip of ["185.26.120.198", "8.8.8.8", "2a00:1450::1"]) assert.equal(isPrivateAddress(ip), false, ip);
});

const base = new URL("https://hram.ru/");
const home = `<nav><a href="/">Главная</a><a href="/novosti/">Новости прихода</a><a href="/raspisanie">Расписание</a>
  <a href="https://www.hram.ru/zhizn-prihoda">Жизнь прихода</a><a href="https://vk.com/x">ВК</a><a href="/doc.pdf">Устав</a></nav>`;

test("ссылки: только свой сайт, без файлов; разделы новостей по адресу и подписи", () => {
    const links = linksOf(home, base);
    assert.deepEqual(links.map((l) => new URL(l.url).pathname), ["/", "/novosti/", "/raspisanie", "/zhizn-prihoda"]);
    assert.deepEqual(newsSections(links, base).map((u) => new URL(u).pathname), ["/novosti/", "/zhizn-prihoda"]);
});

test("статьи раздела — глубже самого раздела, без страниц листания", () => {
    const html = `<a href="/novosti/">все</a><a href="/novosti/prinesenie-kovchega">Ковчег</a>
      <a href="/novosti/?PAGEN_1=2">2</a><a href="/novosti/page/3/">3</a><a href="/kontakty">К</a>`;
    const section = new URL("https://hram.ru/novosti/");
    assert.deepEqual(articlesOf(linksOf(html, section), section), ["https://hram.ru/novosti/prinesenie-kovchega"]);
});

test("карта сайта: страницы и вложенные карты", () => {
    const idx = sitemapLocs(`<sitemapindex><sitemap><loc>https://h.ru/s1.xml</loc></sitemap></sitemapindex>`);
    assert.deepEqual(idx, { pages: [], nested: ["https://h.ru/s1.xml"] });
    const one = sitemapLocs(`<urlset><url><loc>https://h.ru/news/1</loc><lastmod>2026-09-01</lastmod></url><url><loc>https://h.ru/a.jpg</loc></url></urlset>`);
    assert.deepEqual(one.pages, [{ url: "https://h.ru/news/1", lastmod: "2026-09-01" }]);
});

test("текст без скриптов и меню", () => {
    const t = textOf(`<header>шапка</header><script>var x="мощи"</script><p>Первый&nbsp;абзац</p><div>Второй</div><footer>подвал</footer>`);
    assert.equal(t, "Первый абзац\nВторой");
});

test("дата публикации: метатег, адрес, текст", () => {
    assert.equal(publishedOf(`<meta property="article:published_time" content="2026-09-01T10:00:00+03:00">`, "https://h.ru/n"), "2026-09-01");
    assert.equal(publishedOf(`<time datetime="2025-12-24">`, "https://h.ru/n"), "2025-12-24");
    assert.equal(publishedOf(`<p>x</p>`, "https://h.ru/news/2026/09/15/kovcheg"), "2026-09-15");
    assert.equal(publishedOf(`<p>Опубликовано 5 октября 2026 г.</p>`, "https://h.ru/n"), "2026-10-05");
    assert.equal(publishedOf(`<p>12.03.2024 молебен</p>`, "https://h.ru/n"), "2024-03-12");
    assert.equal(publishedOf(`<p>31.02.2024</p>`, "https://h.ru/n"), null);
    assert.equal(publishedOf(`<p>без даты</p>`, "https://h.ru/n"), null);
});

test("дни пребывания, в том числе через Новый год", () => {
    assert.deepEqual(visitOf("с 5 по 12 октября", 2026), { from: "2026-10-05", to: "2026-10-12" });
    assert.deepEqual(visitOf("с 28 сентября по 3 октября", 2026), { from: "2026-09-28", to: "2026-10-03" });
    assert.deepEqual(visitOf("с 28 декабря по 5 января", 2026), { from: "2026-12-28", to: "2027-01-05" });
    assert.deepEqual(visitOf("5–12 октября", 2026), { from: "2026-10-05", to: "2026-10-12" });
    assert.equal(visitOf("в октябре", 2026), null);
});

test("новость о принесённом ковчеге: вид, состояние, дни, святой", () => {
    const text = "Новости прихода\nС 5 по 12 октября в наш храм будет принесён ковчег с частицей мощей святителя Николая Чудотворца. Храм открыт с 8 до 20 часов.";
    const [m] = mentionsOf(text, "2026-09-30");
    assert.equal(m.kind, "chastitsa");
    assert.equal(m.state, "visiting");
    assert.deepEqual(m.visit, { from: "2026-10-05", to: "2026-10-12" });
    assert.equal(m.saintGuess, "святителя Николая Чудотворца");
    assert.equal(isWorthReview(m), true);
});

test("постоянная святыня: «почивают мощи»", () => {
    const [m] = mentionsOf("В соборе почивают мощи преподобного Сергия Радонежского.", "2026-01-10");
    assert.equal(m.state, "present");
    assert.equal(m.kind, "moshchi");
    assert.equal(m.saintGuess, "преподобного Сергия Радонежского");
});

test("голое слово «мощи» без глагола и святого не зовёт на разбор", () => {
    const [m] = mentionsOf("Тропарь: мощи твоя источают исцеления.", null);
    assert.equal(isWorthReview(m), false);
    assert.deepEqual(mentionsOf("Сегодня была литургия.", null), []);
});

test("основы имён для поиска в каталоге", () => {
    assert.deepEqual(nameStems("святителя Николая Чудотворца"), ["никол", "чудотвор"]);
    assert.deepEqual(nameStems("преподобного Сергия Радонежского"), ["серг", "радонежск"]);
    assert.equal(plain("Серги́й Ра́донежский"), "сергий радонежский");
});

test("имя обходчика годится в заголовок HTTP", () => {
    assert.match(CRAWLER_UA, /^[\x20-\x7e]+$/);
});

test("заголовок документа в текст не идёт", () => {
    assert.equal(textOf("<html><head><title>Ковчег</title></head><body><p>Текст</p></body></html>"), "Текст");
});

test("святой берётся до конца строки, а не обрывается", () => {
    const [, m] = mentionsOf("Принесение ковчега\nВ храм будет принесён ковчег с частицей мощей святого благоверного великого князя Александра Невского и святителя Николая Чудотворца.", null);
    assert.equal(m.saintGuess, "святого благоверного великого князя Александра Невского");
});

test("святой по догадке: имя с начала, прозвание — по месту", () => {
    const row = (id: string, name: string) => ({ id, name, slug: null, hay: plain(name) });
    const saints = [row("1", "Кири́лл Александри́йский"), row("2", "Алекса́ндр Сви́рский"), row("3", "Алекса́ндр Не́вский"), row("4", "Се́ргий Ра́донежский")];
    assert.deepEqual(matchSaints("прп. Сергия Радонежского", saints).map((s) => s.id), ["4"]);
    assert.deepEqual(matchSaints("прп. Александра", saints).map((s) => s.id), ["2", "3"]);
    assert.deepEqual(matchSaints("прп. Александра", saints, "Александро-Свирский мужской монастырь").map((s) => s.id), ["2"]);
    assert.deepEqual(matchSaints(null, saints), []);
});
