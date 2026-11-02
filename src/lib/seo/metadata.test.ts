import test from "node:test";
import assert from "node:assert/strict";
import {breadcrumbs, isoDate, pageMetadata, schemaLanguage, seoText, serializeJsonLd} from "./metadata";
import {bookDescription, contentSchema, readingDescription, readingTitle} from "./content";
import {dedupeSitemap, sitemapEntry} from "./sitemap";
import {SITE_URL} from "@/utils/site";

test("описания очищаются от разметки корпуса, Markdown, HTML и ударений", () => {
    assert.equal(seoText('<b>Сло́во</b> {t|reading-slovo|о любви} **Божией** [читать](/reading/slovo)&nbsp;'), "Слово о любви Божией читать");
    const text = seoText("Длинное описание ".repeat(30));
    assert.ok(text.length <= 180);
    assert.ok(text.endsWith("…"));
    assert.equal(seoText(undefined), "");
});

test("JSON-LD не допускает закрытия script и сохраняет исходные строки после разбора", () => {
    const value = {name: '</script><script>alert("x")</script>\u2028'};
    const json = serializeJsonLd(value);
    assert.ok(!json.includes("<"));
    assert.deepEqual(JSON.parse(json), value);
});

test("canonical и карточки используют актуальный домен и одинаковое описание", () => {
    const meta = pageMetadata({title:"Пролог", description:"Сло́во", path:"/library/prolog", noindex:true});
    assert.equal(meta.alternates?.canonical, `${SITE_URL}/library/prolog`);
    assert.equal(meta.description, "Слово");
    assert.deepEqual(meta.robots, {index:false, follow:true});
    assert.equal(meta.openGraph?.description, meta.description);
    assert.equal(meta.twitter?.description, meta.description);
});

test("схема книги и чтения содержит проверяемые данные, язык отделён от начертания", () => {
    const book = {id:"book", alias:"prolog", name:"Пролог", language:"cu_gr", category:"hagiographic"};
    const description = bookDescription(book);
    assert.ok(description.includes("Житийная"));
    assert.ok(description.includes("Оглавление"));
    const schema = contentSchema("library", book, description);
    assert.equal(schema["@type"], "Book");
    assert.equal(schema.inLanguage, "cu");
    assert.equal(schema.dateModified, undefined);
    assert.equal(schemaLanguage("ru_cu"), "ru");
    assert.equal(schemaLanguage("ro_cyr"), "ro");
    const text = {id:"text", name:"Сло́во", bookName:"Пролог", content:"Текст о любви."};
    assert.equal(readingTitle(text), "Слово — Пролог");
    assert.equal(readingDescription(text), "Слово. Пролог. Текст о любви.");
    assert.equal(contentSchema("reading", text, readingDescription(text))["@type"], "CreativeWork");
});

test("хлебные крошки указывают канонические страницы в правильном порядке", () => {
    const data = breadcrumbs([{name:"Главная",path:"/"},{name:"Библиотека",path:"/library"}]);
    assert.equal(data.itemListElement[1].position, 2);
    assert.equal(data.itemListElement[1].item, `${SITE_URL}/library`);
});

test("sitemap не выдумывает даты и выбирает свежую дату среди дублей", () => {
    assert.equal(isoDate("invalid"), undefined);
    assert.equal(isoDate(null), undefined);
    assert.equal(sitemapEntry("/library", undefined, 0.9).lastModified, undefined);
    const entries = dedupeSitemap([
        sitemapEntry("/library", undefined, 0.9),
        sitemapEntry("/library", "2026-10-31", 0.9),
        sitemapEntry("/library", "2026-10-01", 0.9),
    ]);
    assert.equal(entries.length, 1);
    assert.equal(isoDate(entries[0].lastModified), "2026-10-31T00:00:00.000Z");
});
