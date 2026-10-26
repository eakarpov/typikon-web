import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import data from "@/data/kruczie-tone-references.json";
import { buildReferenceProfiles } from "./referenceStats";
import { suggestedReference, referenceProfile, referenceShift } from "./reference";
import { createPlaybackPlan } from "./playback";
import { midiToHz } from "../tunes/notation/playback";

test("повторные копии формулы не увеличивают вес предложенной опоры", async () => {
    const { createCatalog } = await import("@znamenica/kruczie");
    const formula = (id: string, notes: string, sourceId = 1) => ({ _id: id, sourceId, type: 1, tradition: "znamenny", name: id, value: ["Т"], valueNotes: [notes], tone: "1", tones: [1] });
    const catalog = createCatalog({ manifest: { version: "test", retrievedAt: "test", provenance: [], license: "test", completeness: "partial" }, catalogs: [], sources: [{ _id: 1, name: "A", shortname: "a" }, { _id: 2, name: "B", shortname: "b" }],
        formulas: [formula("a", "г1н1"), formula("copy", "г1н1", 2), formula("b", "м1н1"), formula("c", "с2"), formula("invalid", "???")] }).value!;
    const profiles = await buildReferenceProfiles(catalog);
    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].formulaCount, 3);
    assert.deepEqual(profiles[0].endings, [{ midi: 74, count: 2 }, { midi: 76, count: 1 }]);
    assert.deepEqual(profiles[0].sourceIds, [1, 2]);
});
test("опорная ступень не привязана к началу или концу конкретной мелодии", async () => {
    const semitones = referenceShift({ enabled: true, writtenMidi: 74, soundingMidi: 62 }, "znamenny", 2);
    assert.equal(semitones, -12);
    const raw = "м1 н1 г2";
    const base = (await createPlaybackPlan(raw, 96)).value!;
    const tuned = (await createPlaybackPlan(raw, 96, semitones)).value!;
    assert.equal(tuned.tones[1].hz, midiToHz(62));
    assert.notEqual(tuned.tones[0].hz, midiToHz(62));
    assert.notEqual(tuned.tones[2].hz, midiToHz(62));
    assert.deepEqual(tuned.tones.map(n => n.duration), base.tones.map(n => n.duration));
    tuned.tones.forEach((note, i) => assert.equal(note.hz, base.tones[i].hz / 2));
});
test("при недостатке данных или равных лидерах нужна ручная опора", () => {
    assert.equal(referenceProfile("demestvenny", 2), undefined);
    assert.equal(referenceShift({ enabled: true, soundingMidi: 62 }, "demestvenny", 2), 0);
    assert.equal(referenceShift({ enabled: true, writtenMidi: 74, soundingMidi: 62 }, "demestvenny", 2), -12);
    assert.equal(referenceShift({ enabled: false, writtenMidi: 74, soundingMidi: 62 }, "znamenny", 2), 0);
    assert.equal(suggestedReference({ tradition: "znamenny", tone: 1, formulaCount: 2, sourceIds: [], endings: [{ midi: 72, count: 1 }, { midi: 74, count: 1 }] }), null);
});
test("сохранённые подсказки соответствуют закреплённой Git-зависимости и коллекции", async () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    assert.equal(data.dependency, pkg.dependencies["@znamenica/kruczie"]);
    const { createBuiltinCatalog } = await import("@znamenica/kruczie/data");
    const catalog = createBuiltinCatalog();
    assert.equal(data.datasetVersion, catalog.dataset.manifest.version);
    assert.deepEqual(data.profiles, await buildReferenceProfiles(catalog));
    assert.equal(suggestedReference(referenceProfile("znamenny", 2)), 74);
});
test("некорректная настройка высоты не запускает частичное проигрывание", async () => {
    const result = await createPlaybackPlan("г1", 96, NaN);
    assert.equal(result.value, null);
    assert.equal(result.diagnostics[0].code, "INVALID_PLAYBACK_REFERENCE");
});
