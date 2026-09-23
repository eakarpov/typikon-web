import { test } from "node:test";
import assert from "node:assert/strict";
import { isCurrent, overlaps, sourceHref, validateRelic } from "./relics";

const good = {
    saintDneslovId: "1086",
    kind: "moshchi",
    templeSlug: "hram-spiridona",
    source: { type: "book", ref: "Поселянин Е. Русская Церковь и русские подвижники. СПб., 1905. С. 12" },
};

test("запись с источником принимается, состояние по умолчанию — пребывают", () => {
    const r = validateRelic(good);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.value.state, "present");
});

test("без источника запись не принимается", () => {
    const r = validateRelic({ ...good, source: { type: "book", ref: "  " } });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.some((e) => e.includes("источник")));
});

test("источник проверяется по виду", () => {
    assert.equal(validateRelic({ ...good, source: { type: "url", ref: "где-то в сети" } }).ok, false);
    assert.equal(validateRelic({ ...good, source: { type: "url", ref: "https://example.org/a" } }).ok, true);
    assert.equal(validateRelic({ ...good, source: { type: "wikidata", ref: "https://wikidata.org/Q1" } }).ok, false);
    assert.equal(validateRelic({ ...good, source: { type: "wikidata", ref: "Q42" } }).ok, true);
    assert.equal(validateRelic({ ...good, source: { type: "слух", ref: "говорят" } }).ok, false);
});

test("нужно место: храм или место каталога", () => {
    assert.equal(validateRelic({ ...good, templeSlug: "" }).ok, false);
    assert.equal(validateRelic({ ...good, templeSlug: "", placeId: "64f0c0ffee" }).ok, true);
    assert.equal(validateRelic({ ...good, templeSlug: "<script>" }).ok, false);
});

test("святой и вид обязательны", () => {
    assert.equal(validateRelic({ ...good, saintDneslovId: "abc" }).ok, false);
    assert.equal(validateRelic({ ...good, kind: "mosch" }).ok, false);
    assert.equal(validateRelic(null).ok, false);
});

test("ссылка на источник есть не у всякого вида", () => {
    assert.equal(sourceHref({ type: "wikidata", ref: "Q42" }), "https://www.wikidata.org/wiki/Q42");
    assert.equal(sourceHref({ type: "book", ref: "Книга" }), null);
});

test("новость с сайта храма — со ссылкой и датой публикации", () => {
    const news = { ...good, source: { type: "news", ref: "https://hram.ru/news/1" } };
    assert.equal(validateRelic(news).ok, false);
    assert.equal(validateRelic({ ...news, source: { ...news.source, date: "2026-09-01" } }).ok, true);
    assert.equal(validateRelic({ ...news, source: { ...news.source, date: "1 сентября" } }).ok, false);
});

test("принесённые на время — с датами пребывания", () => {
    assert.equal(validateRelic({ ...good, state: "visiting" }).ok, false);
    assert.equal(validateRelic({ ...good, state: "visiting", visit: { from: "2026-10-05", to: "2026-10-01" } }).ok, false);
    const r = validateRelic({ ...good, state: "visiting", visit: { from: "2026-10-01", to: "2026-10-05" } });
    assert.equal(r.ok, true);
    // Даты пребывания у постоянной святыни не хранятся.
    assert.equal((validateRelic({ ...good, visit: { from: "2026-10-01", to: "2026-10-05" } }) as any).value.visit, undefined);
});

test("временная святыня видна только в дни пребывания", () => {
    const v = { state: "visiting" as const, visit: { from: "2026-10-01", to: "2026-10-05" } };
    assert.equal(isCurrent(v, "2026-09-30"), false);
    assert.equal(isCurrent(v, "2026-10-05"), true);
    assert.equal(isCurrent({ state: "former" }, "2026-10-01"), false);
    assert.equal(overlaps(v, "2026-10-04", "2026-10-12"), true);
    assert.equal(overlaps(v, "2026-10-06", "2026-10-12"), false);
});
