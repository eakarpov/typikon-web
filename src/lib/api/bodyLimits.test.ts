import {test} from "node:test";
import assert from "node:assert/strict";
import {isId, isOptionalText, isSmallObject, isText} from "./bodyLimits";

test("строка: непустая, в пределах длины", () => {
    assert.equal(isText("аминь", 10), true);
    assert.equal(isText("   ", 10), false);
    assert.equal(isText("я".repeat(11), 10), false);
    assert.equal(isText({ $ne: "" }, 10), false);
});

test("необязательная строка", () => {
    assert.equal(isOptionalText(undefined, 5), true);
    assert.equal(isOptionalText("да", 5), true);
    assert.equal(isOptionalText(5, 5), false);
});

test("идентификатор", () => {
    assert.equal(isId("dobrotolubie-30"), true);
    assert.equal(isId("65f0c1e2a3b4c5d6e7f80910"), true);
    assert.equal(isId({ $gt: "" }), false);
    assert.equal(isId("a b"), false);
});

test("небольшой объект без операторов", () => {
    assert.equal(isSmallObject({ paragraph: 3, text: "слово" }, 200), true);
    assert.equal(isSmallObject({ text: "я".repeat(300) }, 200), false);
    assert.equal(isSmallObject({ a: { $where: "1" } }, 200), false);
    assert.equal(isSmallObject("строка", 200), false);
});
