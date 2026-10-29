import { test } from "node:test";
import assert from "node:assert/strict";
import { musicalDiagnostics, resolveMusicalGaps } from "./diagnostics";
import { runConversion } from "./playground";
import { inspectWork, translateWorkBlock } from "./work";
test("диагностика пропусков учитывает корпус и сохраняет ошибки формата", () => {
    const diagnostics = [{ code: "UNCOVERED_INPUT", severity: "error" as const, message: "catalog" }, { code: "LAYER_ALIGNMENT", severity: "error" as const, message: "alignment" }];
    assert.deepEqual(musicalDiagnostics(diagnostics, []).map(d => d.code), ["LAYER_ALIGNMENT"]);
    assert.deepEqual(musicalDiagnostics(diagnostics, [1, 3]).at(-1)?.details?.positions, [1, 3]);
    assert.equal(diagnostics.length, 2);
});
test("заполненная корпусом строка не сообщает об отсутствующих нотах", async () => {
    const result = await runConversion({ direction: "to-notes", input: "б_/:о", tradition: "znamenny", tone: 2 });
    assert.ok(result.candidates.length); assert.deepEqual(result.musicalGaps, []);
    assert.ok(!result.displayDiagnostics.some(d => d.code === "UNCOVERED_INPUT" || d.code === "MUSICAL_GAPS"));
    assert.ok(result.result.diagnostics.some(d => d.code === "UNCOVERED_INPUT"));
});
test("частичный разбор показывает только оставшиеся пустые позиции", async () => {
    const view = await inspectWork("%з б_/:о несуществующий\n%т а-б\n");
    const result = await translateWorkBlock(view, 0, { direction: "to-notes", tradition: "znamenny", tone: 2 });
    assert.deepEqual(result.diagnostics.find(d => d.code === "MUSICAL_GAPS")?.details?.positions, [1]);
    assert.ok(!result.diagnostics.some(d => d.code === "UNCOVERED_INPUT"));
});

test("ручное заполнение убирает только разрешённые пропуски", () => {
    const diagnostics = musicalDiagnostics([], [0, 2]);
    assert.deepEqual(resolveMusicalGaps(diagnostics, [true, false, false])[0].details?.positions, [2]);
    assert.deepEqual(resolveMusicalGaps(diagnostics, [true, false, true]), []);
    assert.deepEqual(diagnostics[0].details?.positions, [0, 2]);
});
test("ранее неизвестный крюк получает точные ноты из обновлённой модели", async () => {
    const result = await runConversion({ direction: "to-notes", input: "тДд", tradition: "znamenny", tone: 8 });
    assert.ok(result.candidates.some(c => c.notes === "с1н2"));
    assert.deepEqual(result.musicalGaps, []);
    assert.ok(!result.displayDiagnostics.some(d => d.code === "MUSICAL_GAPS" || d.code === "UNCOVERED_INPUT"));
});
