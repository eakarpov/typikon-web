import {test} from "node:test";
import assert from "node:assert/strict";
import {normalizeChatId} from "./telegram";

test("имя канала без собаки получает её", () => {
    // Ровно этот случай и отвечал «Bad Request: chat not found».
    assert.equal(normalizeChatId("blagoslovi"), "@blagoslovi");
});

test("готовое @имя не трогается", () => {
    assert.equal(normalizeChatId("@blagoslovi"), "@blagoslovi");
});

test("числовой идентификатор остаётся числом", () => {
    // У каналов он отрицательный, и собака здесь сделала бы его неверным.
    assert.equal(normalizeChatId("-1001234567890"), "-1001234567890");
    assert.equal(normalizeChatId("1234567890"), "1234567890");
});

test("пробелы по краям снимаются, пустое остаётся пустым", () => {
    assert.equal(normalizeChatId("  blagoslovi \n"), "@blagoslovi");
    assert.equal(normalizeChatId("   "), "");
});
