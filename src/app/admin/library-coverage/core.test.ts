import test from "node:test";
import assert from "node:assert/strict";
import { stateOf, indexEntries, type Entry } from "./core";
const entry = (status: Entry["status"], edition = "A") => ({ book: "octoechos", language: "cu", edition, status } as Entry);
test("a local candidate prevents treating the entire cell as published", () => {
    assert.equal(stateOf([entry("published"), entry("in_progress", "B")]), "in_progress");
    assert.equal(stateOf([entry("published")]), "published");
});
test("absence of evidence is not a failed search", () => {
    assert.equal(stateOf([]), "unsearched");
    assert.equal(stateOf([entry("not_found")]), "not_found");
});
test("different recensions remain separate witnesses in one language", () => {
    assert.equal(indexEntries([entry("published"), entry("in_progress", "B")]).get("octoechos/cu")?.length, 2);
});
