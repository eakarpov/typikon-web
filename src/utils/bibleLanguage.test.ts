import test from "node:test";
import assert from "node:assert/strict";
import { bibleLanguageShort, bibleLanguageSubstitution } from "@/utils/bibleLanguage";

test("ярлык языка", () => {
    assert.equal(bibleLanguageShort("cs"), "ЦС");
    assert.equal(bibleLanguageShort("grc"), "ГРЕЧ");
    // Незнакомый код не подменяем знакомым: издание могли завести раньше списка.
    assert.equal(bibleLanguageShort("zh"), "ZH");
});

test("подменять не пришлось — показывать нечего", () => {
    assert.equal(bibleLanguageSubstitution("cs", "cs"), null);
    assert.equal(bibleLanguageSubstitution("la", "la"), null);
});

test("подмена называет оба языка", () => {
    const note = bibleLanguageSubstitution("zh", "cs");
    assert.ok(note && note.includes("ЦС") && note.includes("ZH"),
              `в помете должны стоять оба языка, а стоит: ${note}`);
});

test("нечего сравнивать — молчим, а не гадаем", () => {
    assert.equal(bibleLanguageSubstitution(null, "cs"), null);
    assert.equal(bibleLanguageSubstitution("cs", null), null);
    assert.equal(bibleLanguageSubstitution(undefined, undefined), null);
});
