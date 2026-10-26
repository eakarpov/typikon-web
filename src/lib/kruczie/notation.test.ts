import { test } from "node:test";
import assert from "node:assert/strict";
import { displayNotes, staffY } from "./notation";

test("высоты привязаны к линиям скрипичного стана без хроматического сдвига", () => {
    assert.equal(staffY({ step: "E", octave: 4, alteration: 0 }), 90);
    assert.equal(staffY({ step: "B", octave: 4, alteration: 0 }), 70);
    assert.equal(staffY({ step: "C", octave: 5, alteration: 1 }), 65);
});
test("киевская половинная меняет начертание на линии и в промежутке", async () => {
    const { parseMelody } = await import("@znamenica/kruczie/melody");
    const events = parseMelody("н2 с2").value!.events!;
    const display = displayNotes(events, "kievan");
    assert.deepEqual(display.map(n => n.glyph), ["\uEC35", "\uEC36"]);
    assert.deepEqual(display.map(n => n.y), [60, 55]);
});
test("обе нотации сохраняют точки, альтерации, добавочные линии и исходные данные", async () => {
    const { parseMelody } = await import("@znamenica/kruczie/melody");
    const events = parseMelody("#г1. *в2").value!.events!;
    const before = JSON.stringify(events);
    for (const style of ["round", "kievan"] as const) {
        const display = displayNotes(events, style);
        assert.equal(display[0].dot, true);
        assert.ok(display[0].accidental);
        assert.deepEqual(display[1].ledgers, [40, 30]);
    }
    assert.equal(JSON.stringify(events), before);
});
test("неподдержанное начертание не подменяет длительность", async () => {
    const { parseMelody } = await import("@znamenica/kruczie/melody");
    const display = displayNotes(parseMelody("г8 н...").value!.events!, "kievan");
    assert.equal(display[0].glyph, "");
    assert.ok(display[0].warning);
    assert.equal(display[1].glyph, "\uEC32");
});
