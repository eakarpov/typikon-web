import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey, decide, secondsUntilReset, decidePair } from "@/lib/api/v2/quota";
import { TIERS } from "@/lib/api/v2/tokens";

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

// Суточная доля устройства. Ключ приложения один на всех, и общий потолок значит,
// что один поток выкачки кладёт приложение у всех остальных; подушевой потолок
// это и снимает.

test("тариф приложения делит сутки по устройствам, прочие — нет", () => {
    // Делить есть что только там, где ключ общий: ключ одного потребителя делить
    // не с кем.
    assert.equal(TIERS.app.perDevice, 5_000);
    assert.equal(TIERS.app.perClient, true);
    assert.equal(TIERS.free.perDevice ?? null, null);
    assert.equal(TIERS.partner.perDevice ?? null, null);
});

test("доля устройства меньше общей квоты, и заметно", () => {
    // Иначе она ничего не меняет: устройство упрётся в общий потолок раньше
    // собственного, и один поток по-прежнему выест всё.
    assert.ok(TIERS.app.perDevice! < TIERS.app.perDay!);
    assert.ok(TIERS.app.perDevice! * 10 < TIERS.app.perDay!,
        "доля должна быть много меньше общего, иначе десяток устройств выберет всё");
});

test("доля устройства недостижима минутным лимитом за сутки честной работы", () => {
    // Живой читатель не должен упереться в неё никогда. Шестьдесят в минуту — это
    // потолок всплеска, а не поток: подряд сутками так никто не ходит.
    const burst = TIERS.app.limit * 60; // час непрерывных всплесков
    assert.ok(TIERS.app.perDevice! > burst,
        "час подряд на пределе минутного лимита не должен исчерпывать суточную долю");
});

// Решение по двум потолкам сразу.

test("отказ по одному потолку не списывает другой", () => {
    // Иначе устройство, упёршееся в свою долю, разгоняло бы общий счётчик
    // собственными отказами — и выело бы общую квоту, ничего не получив.
    const own = decidePair(10, 500_000, 5_000, 5_000);
    assert.equal(own.verdict.allowed, false);
    assert.equal(own.charge, false, "общий счётчик не трогаем");

    const shared = decidePair(500_000, 500_000, 0, 5_000);
    assert.equal(shared.verdict.allowed, false);
    assert.equal(shared.charge, false, "подушевой счётчик не трогаем");
});

test("общий потолок проверяется первым", () => {
    // Оба исчерпаны: сказать надо про общий — он про весь ключ, и чинится не на
    // устройстве.
    const both = decidePair(500_000, 500_000, 5_000, 5_000);
    assert.equal(both.verdict.limit, 500_000);
});

test("остаток называется более тесный", () => {
    // Клиент упрётся именно в него; обещать ему полмиллиона, когда своих у него
    // четыре тысячи, — врать.
    const verdict = decidePair(1_000, 500_000, 1_000, 5_000).verdict;

    assert.equal(verdict.allowed, true);
    assert.equal(verdict.limit, 5_000);
    assert.equal(verdict.remaining, 3_999);
});

test("без подушевого потолка всё как было", () => {
    const verdict = decidePair(1_000, 500_000, 0, null).verdict;

    assert.equal(verdict.limit, 500_000);
    assert.equal(verdict.remaining, 498_999);
});

test("без потолков вовсе пропускаем", () => {
    const verdict = decidePair(10_000_000, null, 10_000_000, null).verdict;

    assert.equal(verdict.allowed, true);
    assert.equal(verdict.limit, null);
});
