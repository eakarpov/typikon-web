import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    esc,
    pickReadings,
    readOptions,
    renderEmbed,
    shorten,
    type EmbedDay,
    type EmbedReading,
} from "./day";

const options = (over: Partial<ReturnType<typeof readOptions>> = {}) => ({
    ...readOptions(new URLSearchParams(), "2026-03-04"),
    ...over,
});

const day = (over: Partial<EmbedDay> = {}): EmbedDay => ({
    dateLabel: "4 марта 2026, среда",
    churchLabel: "19 февраля ст. ст.",
    dayName: "Среда 2-й седмицы Великого поста",
    memories: [{ name: "Святаго апостола Архиппа", sign: null }],
    readings: [{
        slot: "На шестом часе",
        cites: [{ cite: "Ис. 5:16–25", alias: "biblia-cs-isaii-27", bible: true }],
    }],
    ...over,
});

describe("экранирование", () => {
    it("закрывает всё, чем можно выйти из разметки", () => {
        assert.equal(esc(`<b>&"'`), "&lt;b&gt;&amp;&quot;&#39;");
        assert.equal(esc(null), "");
        assert.equal(esc(undefined), "");
    });

    it("проходит по всякому полю, пришедшему из базы", () => {
        // Виджет стоит на ЧУЖОМ сайте: пропущенное поле — дыра не у нас.
        const html = renderEmbed(day({
            dayName: `<script>alert(1)</script>`,
            memories: [{ name: `<img src=x onerror="alert(2)">`, sign: null }],
            readings: [{
                slot: `<b>слот</b>`,
                cites: [{ cite: `<i>цитата</i>`, alias: `"><script>`, bible: true }],
            }],
        }), options(), "https://www.typikon.su");

        assert.ok(!html.includes("<script>alert(1)"));
        assert.ok(!html.includes("<img src=x"));
        assert.ok(!html.includes("<b>слот</b>"));
        assert.ok(!html.includes(`alias="\"><script>`));
        assert.ok(html.includes("&lt;i&gt;цитата&lt;/i&gt;"));
    });

    it("заголовок из параметра тоже экранирует", () => {
        const html = renderEmbed(day(), options({ title: `</title><script>x` }), "https://x");
        assert.ok(!html.includes("<script>x"));
    });
});

describe("разбор параметров", () => {
    it("без параметров даёт сегодняшний день и оба раздела", () => {
        const got = readOptions(new URLSearchParams(), "2026-03-04");
        assert.equal(got.date, "2026-03-04");
        assert.deepEqual(got.parts, ["memory", "readings"]);
        assert.equal(got.theme, "light");
        assert.equal(got.title, "Чтения дня");
        assert.equal(got.links, true);
        assert.equal(got.only, "all");
    });

    it("неизвестное значение не роняет виджет, а берёт умолчание", () => {
        // Опечатка в параметре не должна оставлять приход с пустой рамкой.
        const got = readOptions(new URLSearchParams("theme=неоновая&parts=погода&date=вчера"), "2026-03-04");
        assert.equal(got.theme, "light");
        assert.deepEqual(got.parts, ["memory", "readings"]);
        assert.equal(got.date, "2026-03-04");
    });

    it("понимает отказ от заголовка и от ссылок", () => {
        const got = readOptions(new URLSearchParams("title=0&links=0&theme=dark&only=bible"), "2026-03-04");
        assert.equal(got.title, null);
        assert.equal(got.links, false);
        assert.equal(got.theme, "dark");
        assert.equal(got.only, "bible");
    });

    it("берёт только известные разделы", () => {
        assert.deepEqual(readOptions(new URLSearchParams("parts=memory"), "2026-03-04").parts, ["memory"]);
    });
});

describe("обрезка длинных имён", () => {
    it("короткое имя не трогает", () => {
        assert.equal(shorten("Быт. 4:16–26"), "Быт. 4:16–26");
    });

    it("длинное режет по слову", () => {
        const long = "Ме́сяца того́же, в 19 день. Па́мять святы́х апо́стол Архи́ппа, и Филимо́на, и Апфи́и";
        const got = shorten(long);
        assert.ok(got.length <= 60, got);
        assert.ok(got.endsWith("…"));
        assert.ok(!got.includes(",…"));
    });

    it("слово длиннее предела режет посередине, а не выбрасывает", () => {
        assert.equal(shorten("а".repeat(80), 10), `${"а".repeat(10)}…`);
    });
});

describe("отбор чтений", () => {
    const readings: EmbedReading[] = [
        { slot: "На шестом часе", cites: [
            { cite: "Ис. 5:16–25", alias: null, bible: true },
            { cite: "Слово 7", alias: null, bible: false },
        ] },
        { slot: "По шестой песни", cites: [{ cite: "Пролог", alias: null, bible: false }] },
    ];

    it("«всё» оставляет как есть", () => {
        assert.deepEqual(pickReadings(readings, "all"), readings);
    });

    it("«только Писание» убирает книжные чтения и опустевшие слоты", () => {
        const got = pickReadings(readings, "bible");
        assert.equal(got.length, 1);
        assert.deepEqual(got[0].cites.map(c => c.cite), ["Ис. 5:16–25"]);
    });
});

describe("рамка без данных", () => {
    it("говорит, что случилось, вместо пустоты", () => {
        const html = renderEmbed(null, options(), "https://www.typikon.su");
        assert.ok(html.includes("недоступны"));
        // Ссылка на сайт остаётся: по ней и приходят разбираться.
        assert.ok(html.includes("/calculator/2026-03-04"));
    });

    it("всегда несёт подпись со ссылкой на источник", () => {
        assert.ok(renderEmbed(day(), options(), "https://www.typikon.su").includes("Уставные чтения"));
    });
});
