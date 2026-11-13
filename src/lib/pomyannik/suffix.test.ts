import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanCommemorationSuffix } from "./suffix";
import { backupPerson, planRestore } from "./backup";

test("suffix is optional, restricted and can be cleared", () => {
    for (const value of [null, undefined, ""]) assert.equal(cleanCommemorationSuffix(value), null);
    for (const value of ["kinsfolk", "child", "children"]) assert.equal(cleanCommemorationSuffix(value), value);
    for (const value of ["other", {}, [], 1]) assert.throws(() => cleanCommemorationSuffix(value));
});
test("backup retains suffix and distinguishes different readings", () => {
    const person = { name: "Анна", kind: "living", commemorationSuffix: "children" };
    const copy = backupPerson(person);
    assert.equal(copy.commemorationSuffix, "children");
    assert.equal(backupPerson({...person, commemorationSuffix: null}).commemorationSuffix, null);
    assert.throws(() => backupPerson({...person, commemorationSuffix: "invalid"}));
    assert.equal(planRestore([], [copy]).additions[0].commemorationSuffix, "children");
});
