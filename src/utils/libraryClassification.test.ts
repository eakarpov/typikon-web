import test from "node:test";
import assert from "node:assert/strict";
import classification from "../data/library/classification-2026-11-01.json";
import { BOOK_CATEGORIES } from "./libraryBooks";
import { BOOK_LANGUAGES } from "./bookLanguages";

test("разметка существующих книг уникальна и использует известные характеристики", () => {
    assert.equal(new Set(classification.map(row => row.id)).size, classification.length);
    for (const row of classification) {
        assert.ok(Object.hasOwn(BOOK_CATEGORIES, row.category), row.name);
        assert.ok(BOOK_LANGUAGES.some(lang => lang.code === row.language), row.name);
        assert.ok(row.reviewed ? row.samples.length > 0 : row.samples.length === 0, row.name);
    }
});

test("непрочитанные пустые заготовки не получают подтверждение языка по тексту", () => {
    const empty = classification.filter(row => !row.reviewed);
    assert.equal(empty.length, 3);
    assert.ok(empty.every(row => row.language === row.previousLanguage));
});
