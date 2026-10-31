import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Db } from "mongodb";
import { liturgicalText } from "./liturgicalText";
import { resolvePericopeVersesWithFallback } from "./pericopes";
import { daySlots } from "@/lib/api/v2/serialize";
import DayPartReading from "@/app/components/DayPartReading";
import { TextType } from "@/utils/texts";
import readings from "@/scripts/data/composite-paremias.json";

test("составное чтение сохраняет порядок Триоди и не выдаётся за набор полных стихов", async () => {
    for (const reading of readings) {
        const result = await resolvePericopeVersesWithFallback({} as Db, reading, "cs");
        assert(result);
        assert.deepEqual(result.verses, []);
        assert.equal(result.editionCode, null);
        assert.equal(result.textId, null);
        assert.equal(result.liturgicalText?.content, reading.liturgicalText.content);
        const fallback = await resolvePericopeVersesWithFallback({} as Db, reading, "ro");
        assert.equal(fallback?.resolvedLang, "cs");
        assert.equal(fallback?.requestedLang, "ro");
    }
    const micah = readings[0].liturgicalText.content;
    assert.ok(micah.indexOf("от Сио́на") < micah.indexOf("услы́шите хо́лми"));
    assert.ok(micah.indexOf("услы́шите хо́лми") < micah.indexOf("упасе́т ста́до"));
    const isaiah = readings[1].liturgicalText.content;
    assert.ok(isaiah.indexOf("жа́ждущии") < isaiah.indexOf("почерпи́те во́ду"));
    assert.ok(isaiah.indexOf("почерпи́те во́ду") < isaiah.indexOf("услы́шите Мене́, и сне́сте"));
});

test("непроверенный язык или испорченная редакция не заменяются полными стихами", async () => {
    const r = readings[0];
    for (const invalid of [{ ...r.liturgicalText, content: "" },
        { ...r.liturgicalText, language: "ro" }, { ...r.liturgicalText, referencesOnly: false },
        { ...r.liturgicalText, sourceUrl: "javascript:alert(1)" }]) {
        assert.equal(liturgicalText(invalid), null);
        assert.equal(await resolvePericopeVersesWithFallback({} as Db, { ...r, liturgicalText: invalid }, "cs"), null);
    }
});

test("API и страница отдают богослужебное тело, а не молча сортируют стиховые ссылки", async () => {
    const reading = readings[1];
    const resolved = await resolvePericopeVersesWithFallback({} as Db, reading, "ro");
    const value = { items: [{ pericope: { ...reading, ...resolved } }] };
    const item = daySlots({ vespersProkimenon: value }, ["vespersProkimenon"], () => "")[0].items[0];
    assert.equal(item.pericope?.liturgicalText?.content, reading.liturgicalText.content);
    assert.deepEqual(item.pericope?.verses, []);
    const html = renderToStaticMarkup(React.createElement(DayPartReading, {
        valueName: TextType.VESPERS_PROKIMENON, value,
    }));
    assert.ok(html.includes("почерпи́те во́ду"));
    assert.ok(html.includes("Богослужебная редакция Цветной Триоди"));
    assert.ok(!html.includes("Не удалось собрать стихи"));
    assert.ok(!readings[3].liturgicalText.content.includes("от Сио́на"));
    assert.ok(!readings[4].liturgicalText.content.includes("попра́х"));
    assert.ok(!readings[5].liturgicalText.content.includes("разде́лится гора́"));
});
