import { test } from "node:test";
import assert from "node:assert/strict";
import { asked, ignoredParams, numeric, readRecord } from "@/lib/datingRecord";

// Разбор условий летописной записи. Читателей у него трое — форма, её адрес и
// ручка API, — и всякое расхождение между ними означало бы, что на один и тот
// же вопрос сайт и приложение отвечают по-разному.

test("числа вне цикла не читаются: индикта 16 не бывает", () => {
    assert.equal(readRecord({ indikt: "16" }).indikt, undefined);
    assert.equal(readRecord({ indikt: "15" }).indikt, 15);
    assert.equal(readRecord({ indikt: "0" }).indikt, undefined);
});

test("эпакта начинается с нуля, а не с единицы", () => {
    // Единственный цикл, у которого нижняя граница ноль. Спутать её с прочими —
    // значит молча выбросить законное условие.
    assert.equal(readRecord({ epakta: "0" }).epakta, 0);
    assert.equal(readRecord({ vrutseleto: "0" }).vrutseleto, undefined);
});

test("месяц без числа дня не задаёт", () => {
    // Иначе перебору нечего приложить ко дню недели.
    assert.equal(readRecord({ month: "3" }).month, undefined);
    assert.equal(readRecord({ day: "5" }).day, undefined);

    const both = readRecord({ month: "3", day: "5" });
    assert.equal(both.month, 3);
    assert.equal(both.day, 5);
});

test("день недели принимается только в своём написании", () => {
    assert.equal(readRecord({ weekday: "воскресенье" }).weekday, "воскресенье");
    // «неделя» — то, как это стоит в источнике, но решатель знает другое слово.
    assert.equal(readRecord({ weekday: "неделя" }).weekday, undefined);
});

test("ключ границ — буква из своего ряда, а не любая", () => {
    assert.equal(readRecord({ klyuchGranits: "З" }).klyuchGranits, "З");
    assert.equal(readRecord({ klyuchGranits: "Я" }).klyuchGranits, undefined);
});

test("пустая запись — не вопрос", () => {
    assert.equal(asked(readRecord({})), false);
    assert.equal(asked(readRecord({ leto: "6712" })), true);
});

test("непрочтённое условие называется вслух", () => {
    // Молча выброшенный день недели дал бы ответ, выглядящий подтверждённым
    // тем, чего в переборе не было.
    const params = { leto: "6712", weekday: "неделя", indikt: "99" };
    const record = readRecord(params);

    assert.deepEqual(ignoredParams(params, record).sort(), ["indikt", "weekday"]);
});

test("прочтённое в непонятое не попадает", () => {
    const params = { leto: "6712", indikt: "7" };

    assert.deepEqual(ignoredParams(params, readRecord(params)), []);
});

test("месяц без дня попадает в непонятое целиком", () => {
    const params = { month: "3" };

    assert.deepEqual(ignoredParams(params, readRecord(params)), ["month"]);
});

test("число вынимается из записи, а не требуется голым", () => {
    // «7-го», «7 индикта» — то, как число стоит в источнике и как его набирают.
    assert.equal(numeric("7", 1, 15), 7);
    assert.equal(numeric("7-го", 1, 15), 7);
});

test("запись без цифр не превращается в ноль", () => {
    // Number("") — ноль, и без проверки границ ноль прошёл бы как условие.
    assert.equal(numeric("абв", 1, 15), undefined);
    assert.equal(numeric("", 1, 15), undefined);
    assert.equal(numeric(undefined, 1, 15), undefined);
});
