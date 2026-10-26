import { test } from "node:test";
import assert from "node:assert/strict";
import { importZnamenText, exportZnamenText, MAX_ZNAMEN_LENGTH } from "./znamen";

const original = "\uFEFF%код test\r\n%текст Заголовок\r\n\r\n%з гТ.\r\n%т ве\r\n\r\n%л.9\r\n%н г1\r\n%т че\r\n%будущее сохранить\r\n";
test("импорт различает музыкальные блоки и сохраняет полный исходник", async () => {
    const file = await importZnamenText(original);
    assert.equal(file.raw, original);
    assert.equal(file.blocks.length, 2);
    assert.equal(file.blocks[0].notation, "гТ.");
    assert.equal(file.blocks[1].melody, "г1");
});
test("неизменённый импорт экспортируется побайтно на уровне строки", async () => {
    const result = await exportZnamenText({ notation: "гТ." }, { raw: original, blockIndex: 0 });
    assert.equal(result.text, original);
});
test("добавление нот меняет только выбранный блок, сохраняя текст, BOM и CRLF", async () => {
    const result = await exportZnamenText({ notation: "гТ.", melody: "г1" }, { raw: original, blockIndex: 0 });
    assert.ok(result.text);
    assert.equal(result.text, original.replace("%з гТ.\r\n%т ве", "%з гТ.\r\n%н г1\r\n%т ве"));
});
test("небезопасная правка не удаляет и не перепривязывает слоги", async () => {
    const result = await exportZnamenText({ melody: "г1 н1" }, { raw: original, blockIndex: 0 });
    assert.equal(result.text, null);
    assert.ok(result.diagnostics.some(d => d.code === "LAYER_ALIGNMENT"));
});
test("новый фрагмент записывает слои и допускает отдельный нотный слой", async () => {
    assert.equal((await exportZnamenText({ notation: "гТ.", melody: "г1" })).text, "%з гТ.\n%н г1\n");
    assert.equal((await exportZnamenText({ melody: "г1" })).text, "%н г1\n");
});
test("пустые, немузыкальные и слишком длинные исходники отклоняются", async () => {
    for (const raw of ["", "%текст Заголовок", "x".repeat(MAX_ZNAMEN_LENGTH + 1)]) await assert.rejects(() => importZnamenText(raw));
    await assert.rejects(() => exportZnamenText({ notation: "Т\n%код injection" }));
});
