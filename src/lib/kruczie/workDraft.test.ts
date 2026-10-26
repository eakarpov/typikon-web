import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectWork } from "./work";
import { createNoteFill, resolvedWorkCells, exportCompletedWork, encodeWorkDraft, decodeWorkDraft, type WorkFills } from "./workDraft";
import { createPlaybackPlan } from "./playback";
const raw = "\uFEFF%код test\r\n%текст Шапка\r\n%з мА \\ _/:\r\n%т Пе-рво-вё\r\n\r\n%з гТ\r\n%т Че\r\n%Разница\r\n  [а|б]\r\n";
test("выбор и ручной ввод переживают сериализацию черновика с пометкой происхождения", async () => {
    const fills: WorkFills = { 0: { 0: await createNoteFill("м2", "catalog"), 1: await createNoteFill("с1 м1", "manual") } };
    const restored = await decodeWorkDraft(encodeWorkDraft({ version: 1, raw, fills }));
    assert.equal(restored.raw, raw);
    assert.deepEqual(restored.fills, fills);
    assert.equal(restored.fills[0][1].raw, "с1м1");
    const view = await inspectWork(raw);
    const cells = resolvedWorkCells(view.blocks[0], undefined, {}, restored.fills[0]);
    assert.equal(cells[0].fillOrigin, "catalog");
    assert.equal(cells[1].fillOrigin, "manual");
    assert.equal(cells[2].syllable.melody, undefined);
    assert.equal(view.blocks[0].cells[1].syllable.melody, undefined);
});
test("завершённое произведение звучит и экспортирует тот же слой, сохраняя текст и крюки", async () => {
    const view = await inspectWork(raw);
    const fills: WorkFills = { 0: { 0: await createNoteFill("м2", "catalog"), 1: await createNoteFill("с1м1", "manual"), 2: await createNoteFill("п2", "manual") }, 1: { 0: await createNoteFill("г2\\", "manual") } };
    const rows = view.blocks.map((row, i) => resolvedWorkCells(row, undefined, {}, fills[i]));
    const exported = await exportCompletedWork(view, rows);
    assert.equal(exported, raw.replace("%т Пе", "%н м2 с1м1 п2\r\n%т Пе").replace("%т Че", "%н г2\\\r\n%т Че"));
    const reimported = await inspectWork(exported);
    assert.equal(reimported.header, view.header);
    assert.equal(reimported.footer, view.footer);
    assert.ok(reimported.file.blocks.every(block => block.aligned));
    const notes = rows.flatMap(row => row.map(cell => cell.syllable.melody!.raw)).join(" ");
    const played = await createPlaybackPlan(notes, 96);
    assert.equal(played.value!.tones.length, 5);
    assert.deepEqual(reimported.blocks.flatMap(row => row.cells.map(c => c.syllable.melody!.raw)), rows.flatMap(row => row.map(c => c.syllable.melody!.raw)));
});
test("пропуски не становятся паузами и не выдают частично заполненный экспорт", async () => {
    const view = await inspectWork(raw);
    await assert.rejects(() => exportCompletedWork(view, view.blocks.map(row => row.cells)), /Блок 1, позиция 1/);
    assert.equal(view.file.raw, raw);
});
test("ручные ноты проверяются целиком; неизвестные, речитация и директивы отклоняются", async () => {
    for (const value of ["", "н...", "с1 ???", "с1\n%т x", "%н с1", "с1 [м1]"]) await assert.rejects(() => createNoteFill(value, "manual"));
});
test("повреждённые или смещённые сохранения не переносят ноты на чужие позиции", async () => {
    for (const text of ['{}', '{"version":2}', JSON.stringify({ version:1, raw, fills:{ 99:{ 0:{ raw:"г2", origin:"manual" } } } }), JSON.stringify({ version:1, raw, fills:{ 0:{ 99:{ raw:"г2", origin:"manual" } } } })]) await assert.rejects(() => decodeWorkDraft(text));
});
