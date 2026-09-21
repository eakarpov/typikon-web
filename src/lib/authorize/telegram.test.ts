import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash, createHmac} from "node:crypto";
import {buildDataCheckString, verifyTelegramAuth, TELEGRAM_AUTH_MAX_AGE_SEC} from "./telegram";

const TOKEN = "123456:TEST-TOKEN";
const NOW = 1_800_000_000;

const sign = (fields: Record<string, string | number>) => {
    const secret = createHash("sha256").update(TOKEN).digest();
    const hash = createHmac("sha256", secret).update(buildDataCheckString(fields)).digest("hex");
    return { ...fields, hash };
};

test("строка подписи: без hash, по алфавиту, через перевод строки", () => {
    assert.equal(
        buildDataCheckString({ username: "u", id: 5, hash: "x", auth_date: 1 }),
        "auth_date=1\nid=5\nusername=u",
    );
});

test("верная подпись принимается, идентификатор берётся из подписанных полей", () => {
    const res = verifyTelegramAuth(sign({ id: 42, first_name: "Иоанн", auth_date: NOW - 10 }), TOKEN, NOW);
    assert.deepEqual(res, { ok: true, userId: "42" });
});

test("подмена идентификатора при чужой верной подписи отвергается", () => {
    const signed = sign({ id: 42, first_name: "Иоанн", auth_date: NOW - 10 });
    const res = verifyTelegramAuth({ ...signed, id: 1 }, TOKEN, NOW);
    assert.deepEqual(res, { ok: false, reason: "bad-hash" });
});

test("просроченный ответ виджета отвергается", () => {
    const res = verifyTelegramAuth(
        sign({ id: 42, auth_date: NOW - TELEGRAM_AUTH_MAX_AGE_SEC - 1 }), TOKEN, NOW);
    assert.deepEqual(res, { ok: false, reason: "stale" });
});

test("без токена бота вход закрыт, а не открыт всем", () => {
    const res = verifyTelegramAuth(sign({ id: 42, auth_date: NOW }), undefined, NOW);
    assert.deepEqual(res, { ok: false, reason: "no-token" });
});

test("вложенные объекты и кривой hash — не разбор, а отказ", () => {
    assert.equal(verifyTelegramAuth({ id: { $ne: 1 }, auth_date: NOW, hash: "0".repeat(64) }, TOKEN, NOW).ok, false);
    assert.equal(verifyTelegramAuth({ id: 1, auth_date: NOW, hash: "zz" }, TOKEN, NOW).ok, false);
    assert.equal(verifyTelegramAuth(null, TOKEN, NOW).ok, false);
});
