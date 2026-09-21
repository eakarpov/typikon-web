import {test} from "node:test";
import assert from "node:assert/strict";
import {isFinished, normaliseProgress, paragraphAnchor, percentRead} from "./progress";

const ID = "65f0c1e2a3b4c5d6e7f80910";

test("верная отметка проходит", () => {
    assert.deepEqual(normaliseProgress({ textId: ID, paragraph: 3, total: 10 }), { textId: ID, paragraph: 3, total: 10 });
});

test("абзац за концом текста прижимается к последнему", () => {
    assert.equal(normaliseProgress({ textId: ID, paragraph: 50, total: 10 })?.paragraph, 9);
});

test("не идентификатор, дробь, отрицательное, оператор — отказ", () => {
    assert.equal(normaliseProgress({ textId: "dobrotolubie-30", paragraph: 1, total: 2 }), null);
    assert.equal(normaliseProgress({ textId: ID, paragraph: 1.5, total: 2 }), null);
    assert.equal(normaliseProgress({ textId: ID, paragraph: -1, total: 2 }), null);
    assert.equal(normaliseProgress({ textId: { $ne: "" }, paragraph: 1, total: 2 }), null);
    assert.equal(normaliseProgress({ textId: ID, paragraph: 0, total: 0 }), null);
    assert.equal(normaliseProgress(null), null);
});

test("дочитано и доля", () => {
    assert.equal(isFinished({ paragraph: 9, total: 10 }), true);
    assert.equal(isFinished({ paragraph: 8, total: 10 }), false);
    assert.equal(percentRead({ paragraph: 0, total: 10 }), 0);
    assert.equal(percentRead({ paragraph: 9, total: 10 }), 100);
    assert.equal(percentRead({ paragraph: 0, total: 1 }), 100);
});

test("якорь абзаца", () => {
    assert.equal(paragraphAnchor(12), "par-12");
});
