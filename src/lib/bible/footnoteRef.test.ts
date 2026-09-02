import test from "node:test";
import assert from "node:assert/strict";
import { footnoteHref, parseFootnotePlace } from "./footnoteRef";

test("место сноски разбирается во всех видах, какие ставит книга", () => {
    assert.deepEqual(parseFootnotePlace("1:1"), { chapter: 1, verse: 1 });
    assert.deepEqual(parseFootnotePlace("50"), { chapter: 50, verse: null });
    // Диапазон и перечисление ведут на первый стих: глава показывается целиком.
    assert.deepEqual(parseFootnotePlace("13:4-7"), { chapter: 13, verse: 4 });
    assert.deepEqual(parseFootnotePlace("1:1,5"), { chapter: 1, verse: 1 });
    assert.equal(parseFootnotePlace(""), null);
    assert.equal(parseFootnotePlace("невесть что"), null);
});

test("сноска на книгу канона ведёт внутрь, к стиху", () => {
    assert.equal(footnoteHref("Быт.1:1"), "/bible/bytie/1#v1");
    assert.equal(footnoteHref("Пс.50"), "/bible/psaltir/50");
});

test("сноска не на книгу адреса не даёт — пусть уходит наружу", () => {
    assert.equal(footnoteHref("см. выше"), null);
    assert.equal(footnoteHref(undefined), null);
    assert.equal(footnoteHref("Быт."), null);
});
