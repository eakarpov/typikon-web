import { test } from "node:test";
import assert from "node:assert/strict";
import { createCorpusIndex, getCorpusUnpitchedVariants, getCorpusRealizations } from "./index";
import type { ChantCollection } from "./types";
const context = { tradition: "znamenny" as const, tone: 2 as const };
async function index() {
    const data: ChantCollection = { schemaVersion: 1, version: "shape", works: [], sources: [], witnesses: [{ id: "w", workId: "w", sourceId: "S", tone: 2, toneEvidence: "fixture", tradition: "znamenny", notationKind: "double", url: "https://example.com/w", rawPath: "w", sha256: "x", attribution: "test", rightsUrl: "https://example.com" }], samples: [{ witnessId: "w", block: 0, positions: [{ position: 0, neumes: "мТ", notes: "м2", text: "а" }, { position: 1, neumes: "нрТ", notes: "н1", text: "б" }, { position: 2, neumes: "(Э:)мТ", notes: "м1", text: "в" }] }], audit: { rejectedBlocks: 0, rejectedPositions: 0, doubleWitnesses: 1, discoveryErrors: 0, scope: "test" } };
    return createCorpusIndex(data);
}
test("беспометный крюк получает предложение с исходной высотой и происхождением", async () => {
    const corpus = await index();
    const found = getCorpusUnpitchedVariants(corpus, "Т", context);
    assert.equal(found.length, 1); assert.equal(found[0].notes, "м2");
    assert.equal(found[0].sourceNeumes, "мТ"); assert.equal(found[0].kind, "unpitched"); assert.equal(found[0].outsideTone, false);
    assert.equal(found[0].ranking.evidence[0].examples[0].sourceId, "S");
    assert.deepEqual(getCorpusRealizations(corpus, "Т", context), []);
    assert.deepEqual(getCorpusUnpitchedVariants(corpus, "мТ", context), []);
    assert.deepEqual(getCorpusUnpitchedVariants(corpus, "сТ", context), []);
    assert.deepEqual(getCorpusUnpitchedVariants(corpus, "Т.", context), []);
    assert.deepEqual(getCorpusUnpitchedVariants(corpus, "Т", { ...context, sourceId: "missing" }), []);
    assert.deepEqual(getCorpusUnpitchedVariants(corpus, "Т", { ...context, tradition: "demestvenny" }), []);
    assert.equal(getCorpusUnpitchedVariants(corpus, "Т", { ...context, tone: 1 })[0].outsideTone, true);
    assert.equal(getCorpusUnpitchedVariants(corpus, "рТ", context)[0].sourceNeumes, "нрТ");
    assert.equal(getCorpusUnpitchedVariants(corpus, "(Э:)Т", context)[0].sourceNeumes, "(Э:)мТ");
    assert.deepEqual(getCorpusUnpitchedVariants(corpus, "(К:)Т", context), []);
    assert.deepEqual(getCorpusUnpitchedVariants(corpus, "Т`", context), []);
});
