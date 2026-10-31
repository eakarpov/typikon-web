import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { applyLiturgicalEnding } from "./liturgicalEnding";
import { pericope, daySlots } from "@/lib/api/v2/serialize";
import { openapi } from "@/lib/api/v2/openapi";
import DayPartReading from "@/app/components/DayPartReading";
import { TextType } from "@/utils/texts";
import readings from "@/scripts/data/pentecostarion-paremias.json";

test("четыре точных окончания отсекают продолжение, не изменяя библейский стих", () => {
    const endings = readings.flatMap(r => r.liturgicalEnding ? [r.liturgicalEnding] : []);
    assert.equal(endings.length, 4);
    for (const ending of endings) {
        const last = { canonChapter: ending.chapter, canonVerse: ending.verse,
            content: `Начало ${ending.endAfter} Лишнее продолжение.` };
        const verses = [{ canonChapter: 1, canonVerse: 1, content: "Первый стих" }, last];
        const clipped = applyLiturgicalEnding(verses, ending, "cs-eliz")!;
        assert.equal(clipped[1].content, `Начало ${ending.endAfter}`);
        assert.equal(verses[1].content, `Начало ${ending.endAfter} Лишнее продолжение.`);
        assert.equal(applyLiturgicalEnding(verses, ending, "ro-1688"), null);
        assert.equal(applyLiturgicalEnding(verses, { ...ending, verse: ending.verse + 1 }, "cs-eliz"), null);
        assert.equal(applyLiturgicalEnding(verses, { ...ending, endAfter: "Нет такой фразы" }, "cs-eliz"), null);
        assert.equal(applyLiturgicalEnding([{ ...last, content: `${ending.endAfter} ${ending.endAfter}` }], ending, "cs-eliz"), null);
        assert.equal(applyLiturgicalEnding(verses, { ...ending, verse: 0 }, "cs-eliz"), null);
    }
});

test("точная граница и источник доступны клиенту API и на странице чтения", () => {
    const reading = readings[0];
    const p = { ...reading, verses: [], requestedLang: "ro", resolvedLang: "cs" };
    assert.deepEqual(pericope(p).liturgicalEnding, reading.liturgicalEnding);
    const slots = daySlots({ vespersProkimenon: { items: [{ pericope: p }] } }, ["vespersProkimenon"], () => "");
    assert.deepEqual(slots[0].items[0].pericope.liturgicalEnding, reading.liturgicalEnding);
    assert.ok("liturgicalEnding" in openapi().components.schemas.Pericope.properties);
    const html = renderToStaticMarkup(React.createElement(DayPartReading, {
        valueName: TextType.VESPERS_PROKIMENON, value: { items: [{ pericope: p }] },
    }));
    assert.ok(html.includes("Последний стих читается частично"));
    assert.ok(html.includes("Точное окончание проверено для церковнославянского издания"));
    assert.ok(html.includes(reading.liturgicalSourceUrl));
});
