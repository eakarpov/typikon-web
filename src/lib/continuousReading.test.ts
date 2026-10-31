import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ContinuousReadingComponent from "@/app/components/ContinuousReading";
import DayPartReading from "@/app/components/DayPartReading";
import { continuousReading, continuousReadingView } from "./continuousReading";
import { daySlots } from "@/lib/api/v2/serialize";
import { getAggregationAddField } from "@/utils/database";
import { TextType } from "@/utils/texts";

const reading = { bookSlug: "deyaniya", fromChapter: 1,
    sourceUrl: "https://azbyka.ru/otechnik/Pravoslavnoe_Bogosluzhenie/tipikon/50" };

test("чтение Деяний с начала не получает выдуманного конца или зачала", () => {
    const view = continuousReadingView(reading)!;
    assert.equal(view.href, "/bible/deyaniya/1");
    assert.equal("ranges" in view, false);
    assert.equal("pericopeId" in view, false);
    for (const invalid of [{ ...reading, bookSlug: "../x" }, { ...reading, fromChapter: 0 },
        { ...reading, fromChapter: 1.5 }, { ...reading, sourceUrl: "javascript:alert(1)" }]) {
        assert.equal(continuousReading(invalid), null);
    }
});

test("страница показывает выбранные Деяния и источник без ссылки на альтернативу", () => {
    const html = renderToStaticMarkup(React.createElement(ContinuousReadingComponent, { value: reading }));
    assert.ok(html.includes('href="/bible/deyaniya/1"'));
    assert.ok(html.includes("Конечная граница"));
    assert.ok(html.includes("Указание Типикона"));
    assert.ok(!html.includes("Златоуст"));
});

test("назначение проходит агрегацию и публичный API отдельно от текста и зачала", () => {
    const aggregation = getAggregationAddField(TextType.VIGIL);
    assert.ok(JSON.stringify(aggregation).includes("$$i.continuousReading"));
    const slots = daySlots({ vigil: { items: [{ paschal: true, continuousReading: reading }] } },
        ["vigil"], () => "Великое чтение");
    assert.equal(slots[0].items[0].continuousReading?.href, "/bible/deyaniya/1");
    assert.equal(slots[0].items[0].text, null);
    assert.equal(slots[0].items[0].pericope, null);
});

test("продолжение Деяний не получает главу 1, диапазон или обещание читать с начала", () => {
    const continuation = { bookSlug: "deyaniya", sourceUrl: reading.sourceUrl };
    const view = continuousReadingView(continuation)!;
    assert.equal(view.href, "/bible#book-deyaniya");
    assert.equal("fromChapter" in view, false);
    assert.equal("ranges" in view, false);
    const html = renderToStaticMarkup(React.createElement(ContinuousReadingComponent, { value: continuation }));
    assert.ok(html.includes("продолжение чтения"));
    assert.ok(html.includes("с места, на котором остановились"));
    assert.ok(!html.includes("читать с начала"));
    const item = daySlots({ vigil: { items: [{ continuousReading: continuation }] } }, ["vigil"], () => "")[0].items[0];
    assert.deepEqual(item.continuousReading, view);
    assert.equal(item.pericope, null);
    for (const fromChapter of [null, 0, 1.5, "1"]) {
        assert.equal(continuousReading({ ...continuation, fromChapter }), null);
    }
});

test("на Всех святых начинается Иаков без назначенного конца", () => {
    const james = { ...reading, bookSlug: "iakova" };
    const view = continuousReadingView(james)!;
    assert.equal(view.href, "/bible/iakova/1");
    const html = renderToStaticMarkup(React.createElement(ContinuousReadingComponent, { value: james }));
    assert.ok(html.includes("Иакова — читать с начала"));
    assert.ok(!html.includes("Деяния"));
    assert.equal("ranges" in view, false);
    const slotHtml = renderToStaticMarkup(React.createElement(DayPartReading, {
        valueName: TextType.VIGIL, value: { items: [{ continuousReading: james }] },
    }));
    assert.ok(slotHtml.includes("Соборнаго послания святаго апостола Иакова"));
    assert.ok(!slotHtml.includes("Деяний святых"));
});
