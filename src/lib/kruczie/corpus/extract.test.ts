import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTrainingSegments } from "./extract";
import { createCorpusIndex, scoreCorpusSequence } from "./index";
import type { ChantCollection } from "./types";
async function extract(raw: string) { const { parseZnamen } = await import("@znamenica/kruczie/formats/znamen"); return extractTrainingSegments(parseZnamen(raw).value!, "w"); }
test("исключённый блок отдаёт только измеренные участки, разрыв не становится парой", async () => {
    const result = await extract("%з гТ нТ сТ\n%н г1 ? с1\n%т а-б-в\n");
    assert.deepEqual(result.samples.map(s => s.positions.map(p => p.position)), [[0], [2]]);
    assert.equal(result.recoveredPositions, 2); assert.equal(result.recoveredBlocks, 1);
    assert.ok(result.samples.every(s => s.recovery === "aligned-segment"));
    const data: ChantCollection = { schemaVersion: 1, version: "test", works: [], sources: [], witnesses: [{ id: "w", workId: "w", sourceId: "S", tone: 2, toneEvidence: "fixture", tradition: "znamenny", notationKind: "double", url: "https://example.com/w", rawPath: "w", sha256: "x", attribution: "test", rightsUrl: "https://example.com" }], samples: result.samples, audit: { rejectedBlocks: 0, rejectedPositions: 1, doubleWitnesses: 1, discoveryErrors: 0, scope: "test" } };
    const index = await createCorpusIndex(data);
    const ranking = scoreCorpusSequence(index, [{ neumes: "гТ", notes: "г1" }, { neumes: "сТ", notes: "с1" }], { tradition: "znamenny", tone: 2 });
    assert.ok(ranking.evidence.every(e => e.order === 1));
    assert.equal(ranking.evidence[0].examples[0].recovery, "aligned-segment");
    assert.equal(ranking.evidence[0].examples[0].tone, 2);
});
test("несовпадение текста допускает только музыкальное соответствие, слоги не сочиняются", async () => {
    const result = await extract("%з гТ нТ\n%н г1 н1\n%т а\n");
    assert.equal(result.samples[0].recovery, "music-only");
    assert.deepEqual(result.samples[0].positions.map(p => p.text), ["", ""]);
    assert.equal(result.recoveredPositions, 2);
});
test("неравные музыкальные слои и однослойная запись не обучают модель", async () => {
    for (const raw of ["%з гТ нТ\n%н г1\n%т а-б\n", "%з гТ\n%т а\n"]) {
        const result = await extract(raw); assert.equal(result.samples.length, 0); assert.equal(result.recoveredPositions, 0);
    }
});
test("речитация и неизвестный крюк разрывают обучение; исходник и валидные позиции сохраняются", async () => {
    const result = await extract("%з гТ ??? сТ\n%н г1 н1 с...\n%т а-б-в\n");
    assert.deepEqual(result.samples[0].positions.map(p => p.position), [0]);
    const valid = await extract("%з гТ нТ\n%н г1 н1\n%т а-б\n");
    assert.equal(valid.samples[0].recovery, undefined); assert.equal(valid.recoveredBlocks, 0);
});
