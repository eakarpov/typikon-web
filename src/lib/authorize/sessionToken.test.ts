import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT, type JWTPayload } from "jose";
import { ObjectId } from "mongodb";
import { resolveSessionToken, type StoredSession } from "./sessionToken";
import { userAccess } from "@/lib/api/v2/userAccess";
import type { Access } from "@/lib/api/v2/access";

const NOW = new Date("2026-10-18T12:00:00Z");
const EXPIRES = new Date("2026-10-19T12:00:00Z");
const KEY = new TextEncoder().encode("session-revocation-test-secret-32-bytes");
const SESSION_ID = "507f1f77bcf86cd799439011";
const USER_ID = "507f191e810c19729de860ea";

const sign = (claims: JWTPayload = {}, key = KEY, algorithm = "HS256") =>
    new SignJWT({ sessionId: SESSION_ID, userId: USER_ID, ...claims })
        .setProtectedHeader({ alg: algorithm })
        .setExpirationTime(EXPIRES)
        .sign(key);

const storedSession = (patch: Partial<StoredSession> = {}): StoredSession => ({
    _id: new ObjectId(SESSION_ID),
    id: USER_ID,
    expiresAt: EXPIRES,
    ...patch,
});

const store = (...sessions: StoredSession[]) => {
    const rows = new Map(sessions.map(session => [session._id.toHexString(), session]));
    const calls: string[] = [];
    return {
        rows, calls,
        read: (token: string | undefined, now = NOW) => resolveSessionToken(token, KEY, async id => {
            calls.push(id);
            return rows.get(id) ?? null;
        }, now),
    };
};

test("действующий JWT открывает только сессию его владельца", async () => {
    const db = store(storedSession());
    const active = await db.read(await sign());
    assert.equal(active?.payload.userId, USER_ID);
    assert.equal(active?.payload.sessionId, SESSION_ID);
    assert.equal(active?.session.id, USER_ID);
    assert.deepEqual(db.calls, [SESSION_ID]);
});

test("отзыв сессии закрывает payload страниц и документ API при повторе той же cookie", async () => {
    const db = store(storedSession());
    const cookie = await sign();
    assert.ok(await db.read(cookie));

    db.rows.delete(SESSION_ID);

    const revoked = await db.read(cookie);
    assert.equal(revoked?.payload ?? null, null);
    assert.equal(revoked?.session ?? null, null);
    assert.deepEqual(db.calls, [SESSION_ID, SESSION_ID], "доступ не кэшируется между запросами");
});

test("ключ API не возвращает личный доступ после отзыва сессии", async () => {
    const db = store(storedSession());
    const cookie = await sign();
    const apiAccess: Access = { denied: null, headers: {}, kind: "token", token: null };
    assert.equal(userAccess(apiAccess, (await db.read(cookie))?.session).userId, USER_ID);

    db.rows.clear();

    const access = userAccess(apiAccess, (await db.read(cookie))?.session ?? null);
    assert.equal(access.userId, "");
    assert.equal(access.denied?.status, 401);
    assert.equal((await access.denied!.json()).error.code, "session_required");
});

test("отзыв одного входа не отзывает другой вход того же пользователя", async () => {
    const secondId = new ObjectId();
    const db = store(storedSession(), storedSession({ _id: secondId }));
    const first = await sign();
    const second = await sign({ sessionId: secondId.toHexString() });
    db.rows.delete(SESSION_ID);
    assert.equal(await db.read(first), null);
    assert.equal((await db.read(second))?.session.id, USER_ID);
});

test("отзыв всех сессий пользователя закрывает все его ещё подписанные JWT", async () => {
    const secondId = new ObjectId();
    const db = store(storedSession(), storedSession({ _id: secondId }));
    const cookies = [await sign(), await sign({ sessionId: secondId.toHexString() })];
    for (const cookie of cookies) assert.ok(await db.read(cookie));
    db.rows.clear();
    for (const cookie of cookies) assert.equal(await db.read(cookie), null);
});

test("сокращённый в базе срок закрывает доступ до истечения JWT", async () => {
    const db = store(storedSession({ expiresAt: NOW }));
    assert.equal(await db.read(await sign()), null);
});

test("сессия без корректного срока в базе не открывает доступ", async () => {
    for (const expiresAt of [undefined, "2026-10-19", new Date(NaN)]) {
        const db = store(storedSession({ expiresAt: expiresAt as Date }));
        assert.equal(await db.read(await sign()), null);
    }
});

test("подписанный JWT с чужим владельцем не открывает запись сессии", async () => {
    const db = store(storedSession({ id: "another-user" }));
    assert.equal(await db.read(await sign()), null);
});

test("истёкший JWT не открывает продлённую запись в базе", async () => {
    const db = store(storedSession({ expiresAt: new Date("2026-10-20T12:00:00Z") }));
    assert.equal(await db.read(await sign(), EXPIRES), null);
    assert.deepEqual(db.calls, [], "плохой JWT отсекается до Mongo");
});

test("неверная подпись, алгоритм, пустая и повреждённая cookie отвергаются до базы", async () => {
    const db = store(storedSession());
    for (const token of [undefined, "", "broken.jwt", await sign({}, new Uint8Array(32)),
        await sign({}, KEY, "HS384")]) {
        assert.equal(await db.read(token), null);
    }
    assert.deepEqual(db.calls, []);
});

test("повреждённые идентификаторы в подписанном JWT отвергаются до базы", async () => {
    const db = store(storedSession());
    for (const claims of [
        { sessionId: "garbage" }, { sessionId: 42 }, { sessionId: null },
        { userId: "" }, { userId: " " }, { userId: 42 }, { userId: null },
    ]) {
        assert.equal(await db.read(await sign(claims)), null);
    }
    assert.deepEqual(db.calls, []);
});

test("JWT без срока действия не принимается даже с существующей сессией", async () => {
    const db = store(storedSession());
    const token = await new SignJWT({ sessionId: SESSION_ID, userId: USER_ID })
        .setProtectedHeader({ alg: "HS256" }).sign(KEY);
    assert.equal(await db.read(token), null);
    assert.deepEqual(db.calls, []);
});

test("без секрета доступ закрыт, lookup не вызывается", async () => {
    const active = await resolveSessionToken(await sign(), new Uint8Array(), async () => {
        assert.fail("нельзя проверять базу без секрета");
    }, NOW);
    assert.equal(active, null);
});

test("недоступность базы не превращается в разрешение по подписи JWT", async () => {
    const unavailable = new Error("Mongo unavailable");
    await assert.rejects(resolveSessionToken(await sign(), KEY, async () => {
        throw unavailable;
    }, NOW), unavailable);
});
