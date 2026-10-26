import { test } from "node:test";
import assert from "node:assert/strict";
import { shiftedMelody, transposeLayers, transposeZnamen } from "./transposition";
import { exportZnamenText } from "./znamen";
const shift = { semitones: 2, tradition: "znamenny" as const };
async function catalog() {
    const { createCatalog } = await import("@znamenica/kruczie");
    return createCatalog({ manifest: { version: "test", retrievedAt: "test", provenance: [], license: "test", completeness: "partial" }, sources: [], formulas: [], catalogs: [{ tradition: "znamenny", groups: [{ _id: 1, name: "test", symbols: [
        { _id: 1, name: "C", value: "", zf: "гТ", notes: "г2" },
        { _id: 2, name: "D", value: "", zf: "нТ", notes: "н2" },
    ] }] }] }).value!;
}
test("перенос сохраняет форму крюка и меняет только подтверждённые пометы", async () => {
    const source = { notation: "гТ  гТ", melody: "г2  г2" };
    const moved = await transposeLayers(source, shift, await catalog());
    assert.deepEqual(moved, { notation: "нТ  нТ", melody: "н2  н2" });
    assert.deepEqual(source, { notation: "гТ  гТ", melody: "г2  г2" });
    assert.deepEqual(await transposeLayers(moved, { ...shift, semitones: -2 }, await catalog()), { notation: "гТ  гТ", melody: "г2  г2" });
});
test("известный крюк без нот допускает перенос только однозначного развода", async () => {
    assert.deepEqual(await transposeLayers({ notation: "гТ" }, shift, await catalog()), { notation: "нТ" });
    await assert.rejects(async () => transposeLayers({ notation: "Т" }, shift, await catalog()), /AMBIGUOUS/);
});
test("нельзя перенести несогласованную пару или заменить крюк произвольным", async () => {
    await assert.rejects(async () => transposeLayers({ notation: "гТ", melody: "м2" }, shift, await catalog()), /UNCONFIRMED_SOURCE_PAIR/);
    await assert.rejects(async () => transposeLayers({ notation: "гТ", melody: "г2" }, { ...shift, semitones: 4 }, await catalog()), /UNCONFIRMED_POMETA_SHIFT/);
    await assert.rejects(async () => transposeLayers({ notation: "гТ`", melody: "г2" }, shift, await catalog()), /UNCONFIRMED_POMETA_SHIFT/);
});
test("стан и звук могут выйти за диапазон ZF, экспорт отклоняется атомарно", async () => {
    const { parseMelody, pitchNumber } = await import("@znamenica/kruczie/melody");
    const original = parseMelody("н1г2").value!;
    const moved = shiftedMelody(original, -12);
    assert.equal(moved.events![0].kind, "note");
    if (moved.events![0].kind === "note") assert.equal(pitchNumber(moved.events![0].pitch), 62);
    assert.notDeepEqual(original, moved);
    await assert.rejects(async () => transposeLayers({ melody: "н1г2" }, { ...shift, semitones: -12 }), /UNREPRESENTABLE/);
    assert.strictEqual(shiftedMelody(original, 0), original);
});
test("экспорт сохраняет слоги, границы нотных групп, BOM, CRLF, шапку и подвал", async () => {
    const raw = "\uFEFF%код test\r\n%текст Шапка\r\n%н г1н1 с2\r\n%т сло-во\r\n\r\n%Разница\r\n  [а|б]\r\n";
    const moved = await transposeZnamen(raw, shift);
    assert.equal(moved, raw.replace("г1н1 с2", "н1с1 #м2"));
    const restored = await transposeZnamen(moved, { ...shift, semitones: -2 });
    assert.equal(restored, raw);
    assert.equal(await transposeZnamen(raw, { ...shift, semitones: 0 }), raw);
});
test("экспорт через модалку переносит также оставшийся музыкальный слой", async () => {
    // Notation is absent here; grouping must still remain aligned with text.
    const raw = "%н г1н1 с2\n%т сло-во\n%Разница\nkeep\n";
    const moved = await exportZnamenText({ melody: "г1н1 с2" }, { raw, blockIndex: 0 }, shift);
    assert.equal(moved.text, raw.replace("г1н1 с2", "н1с1 #м2"));
});
test("ошибка одного блока не выдаёт частично перенесённый документ", async () => {
    const raw = "%н г1\n%т а\n\n%н В2\n%т б\n%Разница\nkeep\n";
    await assert.rejects(() => transposeZnamen(raw, shift), /Блок 2.*UNREPRESENTABLE/);
    assert.equal(raw.includes("%н г1"), true);
    await assert.rejects(async () => transposeLayers({ melody: "г1" }, { ...shift, semitones: NaN }), /INVALID_TRANSPOSITION/);
});

test("реальный каталог: экспорт фрагмента переносит ноты и пометы вместе", async () => {
    const fragment = await exportZnamenText({ notation: "гТ", melody: "г2" }, undefined, shift);
    assert.equal(fragment.text, "%з нТ\n%н н2\n");
    assert.equal(fragment.diagnostics.some(d => d.severity === "error"), false);
    const source = "\uFEFF%код x\r\n%з гТ\r\n%н г2\r\n%т Слог\r\n%Разница\r\nkeep\r\n";
    const result = await exportZnamenText({ notation: "гТ" }, { raw: source, blockIndex: 0 }, shift);
    assert.equal(result.text, source.replace("%з гТ", "%з нТ").replace("%н г2", "%н н2"));
    assert.equal(await transposeZnamen(result.text!, { ...shift, semitones: -2 }), source);
});
