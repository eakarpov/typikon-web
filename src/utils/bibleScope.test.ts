import test from "node:test";
import assert from "node:assert/strict";
import { BIBLE_CANON } from "@/utils/bibleCanon";
import { bibleScopeBooks, bibleScopeTitle, outsideBibleScope } from "@/utils/bibleScope";

test("полный объём — весь канон", () => {
    assert.equal(bibleScopeBooks("full").size, BIBLE_CANON.length);
    assert.equal(bibleScopeBooks(null).size, BIBLE_CANON.length);
});

test("Четвероевангелие — ровно четыре книги", () => {
    const books = bibleScopeBooks("gospels");
    assert.deepEqual([...books].sort(), ["ioanna", "luki", "marka", "matfeya"]);
});

test("Новый Завет держит и Откровение, и Деяния", () => {
    const books = bibleScopeBooks("nt");
    assert.ok(books.has("deyaniya"), "Деяния — часть Нового Завета");
    assert.ok(books.has("otkrovenie"), "Откровение — тоже");
    assert.ok(!books.has("bytie"), "а Бытие — нет");
});

test("вне объёма — не недоделка", () => {
    // Четвероевангелие не содержит Деяний по своей природе…
    assert.equal(outsideBibleScope("gospels", "deyaniya"), true);
    // …а Марка обязано содержать, и его отсутствие — дыра.
    assert.equal(outsideBibleScope("gospels", "marka"), false);
    // Полная Библия обязана всему.
    assert.equal(outsideBibleScope("full", "sirakha"), false);
});

test("незнакомый объём считаем полным, а не пустым", () => {
    // Осторожность важнее удобства: приняв незнакомое за «ничего не содержит»,
    // сверка молча перестала бы искать дыры во всём издании.
    assert.equal(bibleScopeBooks("невнятица").size, BIBLE_CANON.length);
    assert.equal(bibleScopeTitle("невнятица"), "полная Библия");
});
