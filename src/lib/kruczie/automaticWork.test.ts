import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleAutomaticWork } from "./automaticWork";
import { inspectWork, translateWorkBlock, type WorkCandidate, type WorkResult, type WorkView } from "./work";
import type { CorpusRanking } from "./corpus/types";
const ranking = (score: number): CorpusRanking => ({ score, evidence: [], supportedPositions: 2, corpusVersion: "test" });
const partial = (notes: (string | null)[]): WorkResult => ({ blockIndex: 0, candidates: [], status: "untranslated", diagnostics: [], truncated: false, recommendation: { notes, ranking: ranking(5), truncated: false, tied: 2 } });
const source = "\uFEFF%код w20g1\r\n%текст Глас. 2.\r\n%з гТ гТ\r\n%т а-б\r\n%Разница\r\n  [а|о]\r\n";

test("автоматическая склейка берёт совместного победителя, сохраняет весь исходник и не меняет варианты", async () => {
    const view = await inspectWork(source);
    const result = partial(["г1", "н1"]);
    result.positions = [{ index: 0, notes: ["м2", "г1"], melodies: [] }, { index: 1, notes: ["с2", "н1"], melodies: [] }];
    const before = JSON.stringify({ view, result });
    const output = await assembleAutomaticWork(view, { 0: result }, "to-notes");
    assert.equal(output.covered, 2); assert.equal(output.total, 2); assert.equal(output.gaps.length, 0);
    assert.equal(output.notes, "г1 н1"); assert.equal(output.blocks[0].tied, 2);
    assert.ok(output.raw!.startsWith("\uFEFF%код w20g1\r\n%текст Глас. 2.\r\n"));
    assert.ok(output.raw!.endsWith("%Разница\r\n  [а|о]\r\n"));
    assert.deepEqual((await inspectWork(output.raw!)).blocks[0].cells.map(c => c.syllable.text.raw), ["а", "б"]);
    assert.equal(JSON.stringify({ view, result }), before);
});

test("непокрытая позиция не склеивает соседей, не превращается в паузу и блокирует полный экспорт", async () => {
    const view = await inspectWork(source);
    const output = await assembleAutomaticWork(view, { 0: partial(["г1", null]) }, "to-notes");
    assert.equal(output.blocks[0].cells.length, 2);
    assert.equal(output.blocks[0].cells[1].syllable.melody, undefined);
    assert.deepEqual(output.gaps.map(g => [g.block, g.position]), [[0, 1]]);
    assert.equal(output.raw, undefined); assert.equal(output.notes, "");
    const reciting = await assembleAutomaticWork(view, { 0: partial(["г...", "н1"]) }, "to-notes");
    assert.equal(reciting.raw, undefined); assert.match(reciting.gaps[0].reason, /измеренную/u);
});

async function candidate(view: WorkView, notes: string[], score: number): Promise<WorkCandidate> {
    const { parseMelody } = await import("@znamenica/kruczie/melody");
    const cells = view.blocks[0].cells.map((cell, i) => ({ ...cell, syllable: { ...cell.syllable, melody: parseMelody(notes[i]).value! } }));
    return { cells, syllables: cells.map(c => c.syllable), notes: notes.join(" "), neumes: "гТ гТ", origins: [], preferred: false, ranking: ranking(score) };
}
test("полные кандидаты выбираются по рейтингу, а равенство разрешается стабильно без выбора руками", async () => {
    const view = await inspectWork(source);
    const candidates = await Promise.all([candidate(view, ["г1", "г1"], 1), candidate(view, ["н1", "н1"], 9), candidate(view, ["с1", "с1"], 9)]);
    const result: WorkResult = { blockIndex: 0, candidates, status: "translated", diagnostics: [], truncated: true };
    const output = await assembleAutomaticWork(view, { 0: result }, "to-notes");
    assert.equal(output.notes, "н1 н1"); assert.equal(output.blocks[0].tied, 2); assert.equal(output.blocks[0].truncated, true);
    assert.equal(candidates[0].notes, "г1 г1");
});

test("неразмеченный блок сохраняется как неразрешённый, заданные ноты двоезнаменника не перезаписываются", async () => {
    const view = await inspectWork("%з гТ\n%т а-б\n\n%з гТ гТ\n%н с1 м1\n%т в-г\n");
    const output = await assembleAutomaticWork(view, { 1: { ...partial(["г1", "н1"]), blockIndex: 1 } }, "to-notes");
    assert.equal(output.gaps[0].position, null);
    assert.deepEqual(output.blocks[1].cells.map(c => c.syllable.melody?.raw), ["с1", "м1"]);
    assert.equal(output.raw, undefined);
});

test("реальные N-граммные победители автоматически образуют двоезнаменник из нескольких блоков", async () => {
    const view = await inspectWork("%код w20g1\n%текст Глас. 2.\n%з мА рТ. п/:\n%т Пе-рво-ве\n\n%л.2\n%з мА рТ. п/:\n%т а-б-в\n%Разница\n помета\n");
    const results: Record<number, WorkResult> = {};
    for (const row of view.blocks) results[row.index] = await translateWorkBlock(view, row.index, { direction: "to-notes", tradition: "znamenny", tone: 2 });
    assert.ok(results[0].recommendation?.ranking.evidence.some(e => e.order === 3));
    const output = await assembleAutomaticWork(view, results, "to-notes");
    assert.equal(output.covered, 6); assert.equal(output.gaps.length, 0);
    assert.equal(output.blocks[0].cells.map(c => c.syllable.melody!.raw).join(" "), results[0].recommendation!.notes.join(" "));
    const restored = await inspectWork(output.raw!);
    assert.equal(restored.blocks.length, 2); assert.ok(restored.file.blocks.every(b => b.notation && b.melody && b.aligned));
    assert.ok(output.raw!.includes("%л.2\n")); assert.ok(output.raw!.endsWith("%Разница\n помета\n"));
});
