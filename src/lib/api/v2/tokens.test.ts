import { test } from "node:test";
import assert from "node:assert/strict";
import {
    ANONYMOUS_ALLOWANCE,
    TIERS,
    TOKEN_PREFIX,
    allowanceFor,
    generateToken,
    hashToken,
    isSiteRequest,
    readBearer,
    tokenPrefix,
    tokenState,
    type ApiToken,
} from "@/lib/api/v2/tokens";

// Правила доступа решают, кого пускать к публичному API и сколько ему позволено.
// Ошибка здесь либо закрывает API тем, кто вправе им пользоваться, либо раздаёт
// больше, чем задумано, — и то и другое видно не сразу, поэтому проверяем правила
// отдельно от запросов.

const ORIGINS = ["https://typikon.su", "https://www.typikon.su"];

const headers = (values: Record<string, string>) => new Headers(values);

test("выпущенный ключ узнаваем по приставке и каждый раз новый", () => {
    const first = generateToken();
    const second = generateToken();

    assert.ok(first.startsWith(TOKEN_PREFIX));
    assert.notEqual(first, second);
    // 32 случайных байта в base64url — 43 символа.
    assert.ok(first.length >= TOKEN_PREFIX.length + 40);
});

test("в базу уходит хэш, а показываемая часть не выдаёт секрет", () => {
    const token = generateToken();

    assert.equal(hashToken(token), hashToken(token));
    assert.notEqual(hashToken(token), hashToken(generateToken()));
    assert.equal(hashToken(token).length, 64);

    const shown = tokenPrefix(token);
    assert.ok(shown.startsWith(TOKEN_PREFIX));
    assert.ok(shown.length < token.length / 2, "показывать половину ключа нельзя");
});

test("ключ читается и с «Bearer», и без него, и из X-Api-Key", () => {
    const token = generateToken();

    assert.equal(readBearer(headers({ authorization: `Bearer ${token}` })), token);
    assert.equal(readBearer(headers({ authorization: `bearer  ${token}` })), token);
    assert.equal(readBearer(headers({ authorization: token })), token);
    assert.equal(readBearer(headers({ "x-api-key": token })), token);
});

test("чужая авторизация за ключ не принимается", () => {
    assert.equal(readBearer(headers({})), null);
    assert.equal(readBearer(headers({ authorization: "Basic YWxhZGRpbjpvcGVuc2VzYW1l" })), null);
    assert.equal(readBearer(headers({ authorization: "Bearer sk_live_something_else" })), null);
    assert.equal(readBearer(headers({ "x-api-key": "sk_live_something_else" })), null);
});

const token = (over: Partial<ApiToken> = {}): ApiToken => ({
    _id: null as any,
    hash: "",
    prefix: "",
    name: "проверочный",
    userId: "u1",
    tier: "free",
    createdAt: new Date(),
    ...over,
});

test("без поправок ключ получает ровно свой тариф", () => {
    assert.deepEqual(allowanceFor(token({ tier: "free" })), TIERS.free);
    assert.deepEqual(allowanceFor(token({ tier: "app" })), TIERS.app);
});

test("поправки в ключе перекрывают тариф", () => {
    const allowance = allowanceFor(token({ tier: "free", limit: 5, perDay: 100, scopes: ["texts"] }));

    assert.equal(allowance.limit, 5);
    assert.equal(allowance.perDay, 100);
    assert.deepEqual(allowance.scopes, ["texts"]);
    // Незаданное берётся из тарифа.
    assert.equal(allowance.windowSeconds, TIERS.free.windowSeconds);
});

test("perDay: null снимает суточный потолок, а не возвращает тарифный", () => {
    // Тонкое место: null — это «без потолка», и отличить его от «не задано» можно
    // только по undefined. Ошибка здесь молча вернула бы ключу тарифный потолок.
    assert.equal(allowanceFor(token({ tier: "free", perDay: null })).perDay, null);
    assert.equal(allowanceFor(token({ tier: "free" })).perDay, TIERS.free.perDay);
});

test("отозванный и просроченный ключ негодны", () => {
    const now = new Date("2026-08-24T12:00:00Z");

    assert.equal(tokenState(token({}), now), "ok");
    assert.equal(tokenState(token({ expiresAt: new Date("2026-12-31T00:00:00Z") }), now), "ok");
    assert.equal(tokenState(token({ revokedAt: new Date("2026-01-01T00:00:00Z") }), now), "revoked");
    assert.equal(tokenState(token({ expiresAt: new Date("2026-08-01T00:00:00Z") }), now), "expired");
    // Ровно в момент истечения ключ уже негоден.
    assert.equal(tokenState(token({ expiresAt: now }), now), "expired");
});

test("отзыв важнее срока: отозванный ключ не становится просроченным", () => {
    const state = tokenState(
        token({ revokedAt: new Date("2026-08-01T00:00:00Z"), expiresAt: new Date("2026-08-02T00:00:00Z") }),
        new Date("2026-08-24T12:00:00Z"),
    );
    assert.equal(state, "revoked");
});

test("без ключа поиск не выдаётся", () => {
    // Поиск идёт по всему корпусу и стоит дороже прочего — это и есть причина,
    // по которой анонимная порция его не включает.
    assert.ok(!ANONYMOUS_ALLOWANCE.scopes.includes("search"));
    assert.ok(ANONYMOUS_ALLOWANCE.scopes.includes("texts"));
});

test("свой запрос узнаётся по заголовку браузера", () => {
    assert.equal(isSiteRequest(headers({ "sec-fetch-site": "same-origin" }), ORIGINS), true);
    assert.equal(isSiteRequest(headers({ "sec-fetch-site": "cross-site" }), ORIGINS), false);
    // none — переход по адресной строке, а не запрос со страницы сайта.
    assert.equal(isSiteRequest(headers({ "sec-fetch-site": "none" }), ORIGINS), false);
});

test("клиент без заголовков браузера своим не считается", () => {
    // Curl не шлёт ни Sec-Fetch-Site, ни Origin — и не должен получать долю сайта.
    assert.equal(isSiteRequest(headers({}), ORIGINS), false);
    assert.equal(isSiteRequest(headers({ "user-agent": "curl/8.4.0" }), ORIGINS), false);
});

test("при отсутствии Sec-Fetch-Site разбираемся по источнику", () => {
    assert.equal(isSiteRequest(headers({ origin: "https://typikon.su" }), ORIGINS), true);
    assert.equal(isSiteRequest(headers({ "sec-fetch-site": "same-site", origin: "https://www.typikon.su" }), ORIGINS), true);
    assert.equal(isSiteRequest(headers({ referer: "https://typikon.su/search?q=%D0%BF%D0%B0%D1%81%D1%85%D0%B0" }), ORIGINS), true);
    assert.equal(isSiteRequest(headers({ origin: "https://typikon.su.example.com" }), ORIGINS), false);
    assert.equal(isSiteRequest(headers({ origin: "http://typikon.su" }), ORIGINS), false, "http вместо https — не наш адрес");
    assert.equal(isSiteRequest(headers({ origin: "null" }), ORIGINS), false, "песочница iframe шлёт origin: null");
});
