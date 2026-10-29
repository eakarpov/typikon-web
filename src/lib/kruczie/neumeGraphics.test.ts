import { test } from "node:test";
import assert from "node:assert/strict";
import { groupNeumeGraphics, getNeumeGraphics, type NeumeGraphicPart } from "./neumeGraphics";
const part = (kind: NeumeGraphicPart["kind"], raw: string): NeumeGraphicPart => ({ kind, raw, unicode: raw, range: { start: 0, end: raw.length } });
test("подобен прикреплён только к следующему крюку и не становится отдельным музыкальным местом", () => {
    const cue = part("cue", "(Кч)"), glyph = part("glyph", "=ч");
    const groups = groupNeumeGraphics([cue, glyph, part("separator", " "), part("glyph", "Т")]);
    assert.deepEqual(groups[0], { cue: [cue], body: glyph });
    assert.equal(groups.filter(g => g.body.kind === "glyph").length, 2);
    const orphan = groupNeumeGraphics([cue, part("separator", " "), glyph]);
    assert.equal(orphan[2].cue.length, 0); assert.equal(orphan[0].body, cue);
});
test("публичный графический API доступен из пакета, сохраняет подобны и не оставляет их текстом", async () => {
    const parts = await getNeumeGraphics("(ЭТ:)т_/: ТЭ`");
    assert.ok(parts); assert.equal(parts[0].kind, "cue");
    assert.ok(!parts.some(p => p.kind === "unknown"));
});
