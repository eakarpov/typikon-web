import { test } from "node:test";
import assert from "node:assert/strict";
import { eraOf, parseSpan } from "@/lib/places/centuries";

test("век и год, до и после Р. Х.", () => {
    assert.deepEqual(parseSpan("9 век"), { from: 801, to: 900 });
    assert.deepEqual(parseSpan("2 век нашей эры"), { from: 101, to: 200 });
    assert.deepEqual(parseSpan("4 век до н.э."), { from: -400, to: -301 });
    assert.deepEqual(parseSpan("1 век до н.э."), { from: -100, to: -1 });
    assert.deepEqual(parseSpan("862 год"), { from: 862, to: 862 });
    assert.deepEqual(parseSpan("168 год до н.э."), { from: -168, to: -168 });
    assert.equal(parseSpan("давно"), null);
    assert.equal(parseSpan(null), null);
});

test("эпохи прежней легенды", () => {
    assert.equal(eraOf(-400), "ancient");
    assert.equal(eraOf(401), "early");
    assert.equal(eraOf(862), "early");
    assert.equal(eraOf(1001), "medieval");
    assert.equal(eraOf(undefined), null);
});
