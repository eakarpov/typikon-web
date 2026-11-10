import { test } from "node:test";
import assert from "node:assert/strict";
import { compileInlineFootnotes } from "./inlineFootnotes";

test("new notes append without moving legacy numbers; content and poems share one sequence", () => {
    const old = ["Старая", "Ин. 1:1"];
    const saved = compileInlineFootnotes("Текст {2} {fn|Новая}", "Стихи {fn|Ещё} {fn|Новая}", old);
    assert.deepEqual(saved, { content: "Текст {2} {3}", poems: "Стихи {4} {3}", footnotes: [...old, "Новая", "Ещё"] });
    assert.deepEqual(old, ["Старая", "Ин. 1:1"]);
    assert.deepEqual(compileInlineFootnotes(saved.content, saved.poems, saved.footnotes), saved);
});
test("reuse existing note text and preserve unused legacy notes", () => {
    assert.deepEqual(compileInlineFootnotes("{fn|  Старая  }", "", ["Старая", "Не используется"]),
        { content: "{1}", poems: "", footnotes: ["Старая", "Не используется"] });
});
test("reject malformed new notes and collisions with missing old references", () => {
    for (const text of ["{fn|}", "{fn|Примечание", "{fn|{k|Вложенная}}", "{2} {fn|Новая}"]) {
        assert.throws(() => compileInlineFootnotes(text, "", ["Старая"]));
    }
    // Historical errors alone do not prevent saving an unrelated correction.
    assert.equal(compileInlineFootnotes("{2}", "", []).content, "{2}");
});
