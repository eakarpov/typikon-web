import { test } from "node:test";
import assert from "node:assert/strict";
import { cacheVersion } from "./cacheVersion";

test("revision stable for unchanged deployment and corpus", () => {
    const a = cacheVersion("build\n", { size: 100, ctimeMs: 120, mtimeMs: 123 });
    assert.equal(a, cacheVersion("build", { size: 100, ctimeMs: 120, mtimeMs: 123 }));
    assert.match(a, /^[a-f0-9]{64}$/);
});

test("app cache changes for portal, corpus replacement, in-place edit and manual revision", () => {
    const a = cacheVersion("a", { size: 100, ctimeMs: 120, mtimeMs: 123 });
    for (const b of [
        cacheVersion("b", { size: 100, ctimeMs: 120, mtimeMs: 123 }),
        cacheVersion("a", { size: 100, ctimeMs: 120, mtimeMs: 124 }),
        cacheVersion("a", { size: 100, ctimeMs: 121, mtimeMs: 123 }),
        cacheVersion("a", { size: 101, ctimeMs: 120, mtimeMs: 123 }),
        cacheVersion("a", { size: 100, ctimeMs: 120, mtimeMs: 123 }, "refresh-1"),
    ]) assert.notEqual(a, b);
});

test("incomplete metadata never issues a fresh revision", () => {
    assert.throws(() => cacheVersion("  ", { size: 100, ctimeMs: 120, mtimeMs: 123 }));
    assert.throws(() => cacheVersion("a", { size: 100, ctimeMs: 120, mtimeMs: NaN }));
});
