import { test } from "node:test";
import assert from "node:assert/strict";
import { builtinCorpusIndex } from "./builtin";
import { getCorpusFallbacks, getCorpusRealizations, scoreCorpusSequence } from "./index";
import { inspectWork, translateWorkBlock } from "../work";
import { assembleAutomaticWork } from "../automaticWork";
import { runConversion } from "../playground";
const context = { tradition: "znamenny" as const, tone: 2 as const };
test("запасной поиск вне гласа сохраняет источник, происхождение и отдельную оценку", async () => {
    const index = await builtinCorpusIndex();
    assert.deepEqual(getCorpusRealizations(index, "б_/:о", context), []);
    const values = getCorpusFallbacks(index, "б_/:о", context);
    assert.ok(values.length);
    assert.equal(values[0].requestedTone, 2);
    assert.ok(values[0].ranking.evidence.every(e => e.examples.every(r => r.tone !== 2 && r.sourceId && r.url)));
    assert.deepEqual(getCorpusFallbacks(index, "б_/:о", { ...context, sourceId: "missing" }), []);
    assert.deepEqual(getCorpusFallbacks(index, "б_/:о", { ...context, tradition: "demestvenny" }), []);
});
test("единый и ручной разборы получают помеченные варианты; рейтинг выбранного гласа не подделывается", async () => {
    const view = await inspectWork("%код w20g1\n%з б_/:о\n%т а\n%Разница\n помета\n");
    const result = await translateWorkBlock(view, 0, { direction: "to-notes", ...context });
    assert.ok(result.positions?.[0].rankings?.[0].fallbacks?.length);
    assert.equal(result.recommendation?.ranking.score, 0);
    assert.equal(result.recommendation?.ranking.evidence.length, 0);
    assert.equal(result.recommendation?.ranking.fallbacks?.[0].requestedTone, 2);
    const output = await assembleAutomaticWork(view, { 0: result }, "to-notes");
    assert.ok(output.raw?.includes("%н ")); assert.equal(output.gaps.length, 0);
    assert.equal(output.blocks[0].ranking?.fallbacks?.length, 1);
    assert.ok(output.raw?.endsWith("%Разница\n помета\n"));
});
test("известный глас не расширяется запасными вариантами, неизвестный крюк не получает выдуманных нот", async () => {
    for (const [neumes, fallback, covered] of [["мА", false, true], ["мпА", false, false]] as const) {
        const view = await inspectWork(`%з ${neumes}\n%т а\n`);
        const result = await translateWorkBlock(view, 0, { direction: "to-notes", ...context });
        assert.equal(!!result.recommendation?.ranking.fallbacks?.length, fallback);
        const output = await assembleAutomaticWork(view, { 0: result }, "to-notes");
        assert.equal(!!output.raw, covered);
    }
});
test("новые разводы З: и Щ подтверждены вторым гласом в восстановленных блоках", async () => {
    const index = await builtinCorpusIndex();
    for (const neumes of ["З:", "Щ"]) {
        const options = getCorpusRealizations(index, neumes, context);
        assert.ok(options.length, neumes);
        assert.deepEqual(getCorpusFallbacks(index, neumes, context), []);
        const ranking = scoreCorpusSequence(index, [{ neumes, notes: options[0] }], context);
        assert.ok(ranking.evidence.some(e => e.examples.some(r => r.tone === 2 && r.recovery)), neumes);
    }
});
test("отдельная строка тоже получает корпусный вариант с явной пометкой чужого гласа", async () => {
    const result = await runConversion({ direction: "to-notes", input: "б_/:о", ...context });
    assert.ok(result.candidates.length);
    assert.equal(result.corpusCoverage?.outsideTone, 1);
    assert.ok(result.candidates[0].ranking?.fallbacks?.length);
    assert.equal(result.candidates[0].kind, "constructed");
    const empty = await runConversion({ direction: "to-notes", input: "б_/:о", ...context, corpusSourceId: "missing" });
    assert.equal(empty.candidates.length, 0);
});
