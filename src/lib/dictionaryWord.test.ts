import { test } from "node:test";
import assert from "node:assert/strict";
import { dictionaryWord, dictionaryHref } from "./dictionaryWord";

test("dictionary lookup accepts accented Church Slavonic words and rejects phrases", () => {
    assert.equal(dictionaryWord("«глаго́лахꙋ,»"), "глаго́лахꙋ");
    assert.equal(dictionaryWord("по-прежнему"), "по-прежнему");
    for (const text of ["", "два слова", "123", "а".repeat(81)]) assert.equal(dictionaryWord(text), null);
    assert.equal(dictionaryHref("Слово"), `/dictionary?query=${encodeURIComponent("Слово")}`);
});
