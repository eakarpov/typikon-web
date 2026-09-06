import test from "node:test";
import assert from "node:assert/strict";
import { encodeText, withCrlf } from "@/lib/csEncoding/download";

test("UTF-8 с меткой и без", () => {
    // «а҃» — а с титлом: два знака, три и два байта соответственно.
    assert.deepEqual([...encodeText("а҃", "utf-8")], [0xd0, 0xb0, 0xd2, 0x83]);
    assert.deepEqual([...encodeText("а҃", "utf-8-bom")], [0xef, 0xbb, 0xbf, 0xd0, 0xb0, 0xd2, 0x83]);
});

test("UTF-16LE — с меткой порядка байтов", () => {
    // Без метки Word читает файл как CP1251 и показывает ровно тот мусор, от
    // которого читатель сюда и пришёл.
    assert.deepEqual([...encodeText("а҃", "utf-16le")], [0xff, 0xfe, 0x30, 0x04, 0x83, 0x04]);
});

test("суррогатная пара переносится целой", () => {
    // Глаголица лежит за пределами основной плоскости (U+2C00 — кириллическая,
    // а вот U+1E000 — знаки глаголического письма). charCodeAt отдаёт кодовые
    // единицы, и пара сама собой ложится четырьмя байтами.
    const glagolitic = String.fromCodePoint(0x1e000);
    assert.deepEqual([...encodeText(glagolitic, "utf-16le")], [0xff, 0xfe, 0x38, 0xd8, 0x00, 0xdc]);
    assert.deepEqual([...encodeText(glagolitic, "utf-8")], [0xf0, 0x9e, 0x80, 0x80]);
});

test("переводы строк по-виндовски", () => {
    assert.equal(withCrlf("а\nб"), "а\r\nб");
    // Уже виндовские не удваиваются.
    assert.equal(withCrlf("а\r\nб"), "а\r\nб");
});
