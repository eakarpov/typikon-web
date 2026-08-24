import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey, decide, secondsUntilReset } from "@/lib/api/v2/quota";

// Суточная квота — единственное, что удерживает медленную равномерную выкачку корпуса:
// минутный лимит её пропускает целиком. Считать её надо правильно, иначе она либо
// не наступает никогда, либо наступает раньше обещанного.

test("сутки считаются по UTC", () => {
    assert.equal(dayKey(new Date("2026-08-24T00:00:00Z")), "2026-08-24");
    assert.equal(dayKey(new Date("2026-08-24T23:59:59Z")), "2026-08-24");
    // 02:00 по Москве 25-го — это ещё сутки 24-го по UTC.
    assert.equal(dayKey(new Date("2026-08-24T23:00:00Z")), "2026-08-24");
});

test("до обнуления считается остаток суток", () => {
    assert.equal(secondsUntilReset(new Date("2026-08-24T00:00:00Z")), 86400);
    assert.equal(secondsUntilReset(new Date("2026-08-24T23:59:30Z")), 30);
    // Ноль не отдаём никогда: Retry-After: 0 клиент прочтёт как «можно сразу».
    assert.ok(secondsUntilReset(new Date("2026-08-24T23:59:59.900Z")) >= 1);
});

test("ключ без потолка проходит всегда", () => {
    const verdict = decide(1_000_000, null);

    assert.equal(verdict.allowed, true);
    assert.equal(verdict.limit, null);
    assert.equal(verdict.remaining, null);
});

test("остаток считается с учётом текущего запроса", () => {
    // decide вызывается до списания, поэтому из остатка вычитается и этот запрос:
    // иначе клиент, получивший remaining: 1, упирался бы в отказ на следующем.
    assert.deepEqual(decide(0, 10).remaining, 9);
    assert.deepEqual(decide(9, 10).remaining, 0);
});

test("на исчерпанной квоте отказ, и остаток не уходит в минус", () => {
    const verdict = decide(10, 10);

    assert.equal(verdict.allowed, false);
    assert.equal(verdict.remaining, 0);

    // Расход больше потолка возможен после понижения квоты у живого ключа.
    const lowered = decide(5000, 10);
    assert.equal(lowered.allowed, false);
    assert.equal(lowered.remaining, 0);
});
