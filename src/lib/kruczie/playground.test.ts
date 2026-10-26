import { test } from "node:test";
import assert from "node:assert/strict";
import { runConversion } from "./playground";
import { EXAMPLES, MAX_INPUT_LENGTH } from "./model";

test("знаменный пример переводится в обе стороны с происхождением вариантов", async () => {
    const forward = await runConversion({ direction: "to-notes", tradition: "znamenny", input: EXAMPLES.znamenny["to-notes"] });
    assert.ok(forward.candidates.length);
    assert.ok(forward.candidates.some(c => c.notes === EXAMPLES.znamenny["to-neumes"]));
    assert.ok(forward.candidates[0].origins.length);
    assert.equal(forward.result.coverage.covered, forward.result.coverage.total);
    const reverse = await runConversion({ direction: "to-neumes", tradition: "znamenny", input: forward.candidates[0].notes });
    assert.ok(reverse.candidates.length);
    assert.ok(reverse.datasetVersion);
});
test("демественный пример работает отдельно от знаменного", async () => {
    for (const direction of ["to-notes", "to-neumes"] as const) {
        const result = await runConversion({ direction, tradition: "demestvenny", input: EXAMPLES.demestvenny[direction] });
        assert.ok(result.candidates.length);
        assert.ok(result.candidates.every(c => c.origins.every(o => !o.includes("Ссылка на запись не разрешена"))));
    }
});
test("неизвестные ноты сохраняют диагностику и не дают ложного полного перевода", async () => {
    const result = await runConversion({ direction: "to-neumes", tradition: "znamenny", input: "???" });
    assert.equal(result.candidates.length, 0);
    assert.ok(result.result.diagnostics.some(d => d.code === "UNKNOWN_NOTE" && d.range));
});
test("глас и ограничения поиска передаются библиотеке", async () => {
    const result = await runConversion({ direction: "to-notes", tradition: "demestvenny", tone: 1, input: EXAMPLES.demestvenny["to-notes"] });
    assert.equal(result.candidates.length, 0);
    const bounded = await runConversion({ direction: "to-neumes", tradition: "znamenny", input: EXAMPLES.znamenny["to-neumes"] });
    assert.ok(bounded.candidates.length <= 8);
});
test("пустой и слишком длинный ввод отклоняются до поиска", async () => {
    for (const input of [" ", "г".repeat(MAX_INPUT_LENGTH + 1)])
        await assert.rejects(() => runConversion({ direction: "to-notes", tradition: "znamenny", input }));
});
