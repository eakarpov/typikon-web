import {test} from "node:test";
import assert from "node:assert/strict";
import {nameHashtagWords} from "./hashtags";

test("союз «и» в хэштеги не попадает", () => {
    assert.deepEqual(nameHashtagWords("Пётр и Павел"), ["Пётр", "Павел"]);
});

test("предлоги тоже отбрасываются", () => {
    assert.deepEqual(nameHashtagWords("Иоанн от Скита"), ["Иоанн", "Скита"]);
});

test("короткое имя остаётся: длина не повод выбрасывать", () => {
    // Мученица Ия — имя из двух букв; правило «короче трёх — выбросить» отняло бы его.
    assert.deepEqual(nameHashtagWords("Ия"), ["Ия"]);
});

test("ударения не мешают распознать служебное слово", () => {
    // Днеслов пишет с ударениями, и союз может приехать размеченным.
    assert.deepEqual(nameHashtagWords("Пётр и́ Павел"), ["Пётр", "Павел"]);
});

test("числа хэштегами не становятся", () => {
    assert.deepEqual(nameHashtagWords("9 мучеников Пергийских"), ["мучеников", "Пергийских"]);
});

test("пустое имя даёт пустой список", () => {
    assert.deepEqual(nameHashtagWords(""), []);
    assert.deepEqual(nameHashtagWords(null), []);
    assert.deepEqual(nameHashtagWords(undefined), []);
});
