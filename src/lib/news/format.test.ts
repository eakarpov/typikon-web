import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeXml, hasUnread, rssXml, slugify, uniqueAlias } from "@/lib/news/format";

// Новости — единственное место, где сайт говорит с читателем от себя. Ошибка здесь
// не роняет страницу, а тихо портит: битый адрес, вечно горящая точка «новое»,
// непринятый читалкой фид.

test("адрес записи получается латиницей и читаемым", () => {
    assert.equal(slugify("Добавили Минею за август"), "dobavili-mineyu-za-avgust");
    assert.equal(slugify("Версия 1.7: офлайн-режим"), "versiya-1-7-oflayn-rezhim");
    assert.equal(slugify("  Пробелы   по краям  "), "probely-po-krayam");
});

test("адрес не остаётся пустым и не тянет за собой мусор", () => {
    // Заголовок из одних знаков препинания — редкость, но адрес нужен и ему.
    assert.equal(slugify("!!! ??? ..."), "novost");
    assert.equal(slugify("Ёлки-палки"), "elki-palki");
    // Хвостовой дефис после обрезки длины оставлять нельзя.
    const long = slugify("а".repeat(80));
    assert.ok(long.length <= 60);
    assert.ok(!long.endsWith("-"));
});

test("занятый адрес получает номер, а не перезаписывает чужую запись", () => {
    assert.equal(uniqueAlias("obnovlenie", []), "obnovlenie");
    assert.equal(uniqueAlias("obnovlenie", ["obnovlenie"]), "obnovlenie-2");
    assert.equal(uniqueAlias("obnovlenie", ["obnovlenie", "obnovlenie-2"]), "obnovlenie-3");
});

test("точка «новое» загорается только тому, кто уже читал", () => {
    const latest = "2026-08-25T10:00:00.000Z";

    assert.equal(hasUnread(latest, "2026-08-24T10:00:00.000Z"), true);
    assert.equal(hasUnread(latest, latest), false, "прочитанное повторно не считается");
    assert.equal(hasUnread(latest, "2026-08-26T10:00:00.000Z"), false);
    // Пришедший впервые не должен видеть точку: она бы горела у всех и всегда.
    assert.equal(hasUnread(latest, null), false);
    assert.equal(hasUnread(null, null), false);
    assert.equal(hasUnread(null, "2026-08-24T10:00:00.000Z"), false);
    // Испорченная отметка — тот же случай, что и её отсутствие.
    assert.equal(hasUnread(latest, "позавчера"), false);
});

test("в XML не уезжают сырые амперсанды и скобки", () => {
    assert.equal(escapeXml('Минея & «Пролог» <новое>'), "Минея &amp; «Пролог» &lt;новое&gt;");
});

test("фид собирается с обязательными полями и датой по RFC 822", () => {
    const xml = rssXml([{
        alias: "obnovlenie",
        title: "Добавили Минею & Пролог",
        summary: "Коротко о том, что изменилось",
        publishedAt: "2026-08-25T10:00:00.000Z",
    }], "https://typikon.su");

    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.ok(xml.includes("<link>https://typikon.su/news/obnovlenie</link>"));
    assert.ok(xml.includes("<pubDate>Tue, 25 Aug 2026 10:00:00 GMT</pubDate>"));
    assert.ok(xml.includes("Добавили Минею &amp; Пролог"));
    assert.ok(!xml.includes("Минею & Пролог"), "сырой амперсанд ломает читалки");
});

test("пустая лента остаётся годным фидом", () => {
    const xml = rssXml([], "https://typikon.su");

    assert.ok(xml.includes("<channel>"));
    assert.ok(xml.includes("</rss>"));
    assert.ok(!xml.includes("<item>"));
});
