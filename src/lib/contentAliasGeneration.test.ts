import test from "node:test";
import assert from "node:assert/strict";
import { contentAliasBase } from "./contentAliasGeneration";

test("alias includes the book category and strips combining accents", () => {
    assert.equal(contentAliasBase("Сло́во на Па́сху", "patristic"), "patristic-slovo-na-pashu");
    assert.notEqual(contentAliasBase("Слово", "patristic"), contentAliasBase("Слово", "liturgical"));
    assert.match(contentAliasBase("Книга"), /^[a-z0-9-]+$/);
    assert.throws(() => contentAliasBase("  "));
});
