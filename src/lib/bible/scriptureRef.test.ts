import { test } from "node:test";
import assert from "node:assert/strict";
import { parseScriptureRef } from "@/lib/bible/scriptureRef";

// Грамматика bible:-адресов пакета .ordo: bible:<книга>.<глава>[.<стих>[-<стих>]].

test("адрес разбирается: глава, стих, отрезок", () => {
    assert.deepEqual(parseScriptureRef("bible:1-korinfyanam.14.20-25"), {
        canonId: "1-korinfyanam", chapter: 14, from: 20, to: 25,
    });
    assert.deepEqual(parseScriptureRef("bible:matfeya.16.13-18"), {
        canonId: "matfeya", chapter: 16, from: 13, to: 18,
    });
    assert.deepEqual(parseScriptureRef("bible:psaltyr.109.1"), {
        canonId: "psaltyr", chapter: 109, from: 1, to: null,
    });
    assert.deepEqual(parseScriptureRef("bible:psaltyr.109"), {
        canonId: "psaltyr", chapter: 109, from: null, to: null,
    });
});

test("мусор не разбирается", () => {
    assert.equal(parseScriptureRef("bible:"), null);
    assert.equal(parseScriptureRef("bible:kniga"), null);
    assert.equal(parseScriptureRef("bible:kniga.0"), null);
    assert.equal(parseScriptureRef("bible:kniga.3.0"), null);
    assert.equal(parseScriptureRef("bible:kniga.3.7-2"), null); // отрезок назад
    assert.equal(parseScriptureRef("formula:some.1"), null);
    assert.equal(parseScriptureRef("бытие 1:1"), null);
});
