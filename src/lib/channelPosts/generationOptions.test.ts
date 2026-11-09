import test from "node:test";
import assert from "node:assert/strict";
import { generationOptions } from "./generationOptions";

test("generation accepts a bounded inclusive period in civil dates", () => {
    const opts = generationOptions({ from: "2026-11-09", daysAhead: "3" });
    assert.equal(opts.from.toISOString(), "2026-11-09T00:00:00.000Z");
    assert.equal(opts.daysAhead, 3);
    assert.equal(generationOptions({ from: "2026-12-31", daysAhead: 0 }).daysAhead, 0);
});

test("invalid dates and unbounded generation are rejected", () => {
    for (const from of ["2026-02-30", "2026-13-01", "bad", {}, 123]) {
        assert.throws(() => generationOptions({ from }));
    }
    for (const daysAhead of [-1, 1.5, 31, Infinity, "no"]) {
        assert.throws(() => generationOptions({ from: "2026-11-09", daysAhead }));
    }
});
