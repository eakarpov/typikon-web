import test from "node:test";
import assert from "node:assert/strict";
import { verdictOf, GROUPS } from "@/lib/csEncoding/coverage";

test("без контрольной пары вывод не делается", () => {
    // Ложное «знака нет» хуже отсутствия проверки, поэтому недостоверное
    // измерение не превращается ни в одно из двух утверждений.
    assert.equal(verdictOf({ differsFromNotdef: true, controlPassed: false }), "unknown");
    assert.equal(verdictOf({ differsFromNotdef: false, controlPassed: false }), "unknown");
});

test("состоявшееся измерение читается прямо", () => {
    assert.equal(verdictOf({ differsFromNotdef: true, controlPassed: true }), "present");
    assert.equal(verdictOf({ differsFromNotdef: false, controlPassed: true }), "missing");
});

test("проверяются те знаки, что встречаются в собрании", () => {
    const all = GROUPS.flatMap((g) => g.chars).join("");
    // Разряды, из-за которых текст и рассыпается: выносные, титло, уставные
    // начертания, знак тысячи.
    assert.match(all, /ⷣ/);   // выносная д
    assert.match(all, /҃/);   // титло
    assert.match(all, /҇/);   // покрытие
    assert.match(all, /ᲂ/);   // о узкое
    assert.match(all, /҂/);   // знак тысячи
    for (const group of GROUPS) {
        assert.ok(group.note.length > 20, `у разряда «${group.name}» нет объяснения`);
    }
});
