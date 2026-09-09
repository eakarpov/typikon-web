import { test } from "node:test";
import assert from "node:assert/strict";
import { genreOfBook } from "@/lib/accents/genre";

// Род текста решает, по какому собранию считать ударение. Ошибка здесь не видна
// ни в логе, ни на глаз: текст размечен, просто часть слов — не тем ударением,
// и узнает об этом только тот, кто прочтёт вслух.

test("службы поются", () => {
    assert.equal(genreOfBook("Службы"), "chant");
});

test("прочее читается", () => {
    // Маргарит — беседы Златоуста, Пролог — жития, ПВЛ — летопись.
    assert.equal(genreOfBook("Маргарит"), "reading");
    assert.equal(genreOfBook("Пролог (август)"), "reading");
    assert.equal(genreOfBook("Повесть временных лет"), "reading");
});

test("книги не знаем — считаем чтением", () => {
    // Умолчание разметчика, и оно же верно для подавляющего большинства корпуса.
    assert.equal(genreOfBook(null), "reading");
    assert.equal(genreOfBook(undefined), "reading");
    assert.equal(genreOfBook(""), "reading");
});

test("лишние пробелы вокруг имени не сбивают", () => {
    // Имя приходит из базы, где его правят руками.
    assert.equal(genreOfBook("  Службы  "), "chant");
});
