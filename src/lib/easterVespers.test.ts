import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DAY_SLOT_ORDER, TextType, valueTitle } from "@/utils/texts";
import { daySlots } from "@/lib/api/v2/serialize";
import DayPartReading from "@/app/components/DayPartReading";

test("вечернее Евангелие самого дня Пасхи следует за Литургией и не попадает в утреннее", () => {
    assert.equal(new Set(DAY_SLOT_ORDER).size, DAY_SLOT_ORDER.length);
    assert.ok(DAY_SLOT_ORDER.indexOf(TextType.GOSPEL_VESPERS) > DAY_SLOT_ORDER.indexOf(TextType.GOSPEL_LITURGY));
    const item = { pericope: { id: "6a820cb93f7812bfa7c4f603", source: "gospel", label: "Ин.65Б",
        bookSlug: "ioanna", ranges: [{ chapterFrom: 20, verseFrom: 19, chapterTo: 20, verseTo: 25 }],
        verses: [] } };
    const slots = daySlots({ gospelVespers: { items: [item] } }, DAY_SLOT_ORDER, s => valueTitle(s as TextType));
    const filled = slots.filter(s => s.items.length);
    assert.equal(filled.length, 1);
    assert.equal(filled[0].slot, TextType.GOSPEL_VESPERS);
    assert.equal(filled[0].items[0].pericope?.label, "Ин.65Б");
    const html = renderToStaticMarkup(React.createElement(DayPartReading, {
        valueName: TextType.GOSPEL_VESPERS, value: { items: [item] }, paschal: true,
    }));
    assert.ok(html.includes("Евангелие на вечерне"));
    assert.ok(html.includes('href="/bible/ioanna/20"'));
    assert.ok(!html.includes("Евангелие на утрени"));
});
