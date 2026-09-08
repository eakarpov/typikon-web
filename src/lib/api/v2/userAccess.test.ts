import { test } from "node:test";
import assert from "node:assert/strict";
import { userAccess } from "@/lib/api/v2/userAccess";
import { ALL_SCOPES, FREE_SCOPES } from "@/lib/api/v2/tokens";
import type { Access } from "@/lib/api/v2/access";

// Личный доступ: ключ отмеряет, сессия открывает. Ошибка здесь либо показывает
// чужой помянник, либо — что случается тише и потому опаснее — сообщает клиенту
// об отсутствии входа тем же кодом, каким сообщают о негодном ключе.

const granted: Access = {
    denied: null,
    headers: { "X-RateLimit-Limit": "60" },
    kind: "token",
    token: null,
};

const refused: Access = {
    denied: new Response(null, { status: 401 }),
    headers: {},
    kind: "anonymous",
    token: null,
};

test("сессия открывает список её хозяину", () => {
    const access = userAccess(granted, { id: "user-1" });

    assert.equal(access.denied, null);
    assert.equal(access.userId, "user-1");
    // Заголовки об остатке доезжают: их считает ключ, а не сессия.
    assert.equal(access.headers["X-RateLimit-Limit"], "60");
});

test("ключ без сессии — это session_required, а не unauthorized", async () => {
    // Различие держит на себе работоспособность всего приложения: по «401 на
    // запрос с ключом» оно объявляет ключ мёртвым и уходит в анонимы всем
    // корпусом, а сессия сайта живёт час.
    const access = userAccess(granted, null);

    assert.equal(access.userId, "");
    assert.equal(access.denied?.status, 401);
    const body = await access.denied!.json();
    assert.equal(body.error.code, "session_required");
});

test("отказ по ключу возвращается как есть, и сессия его не отменяет", async () => {
    const access = userAccess(refused, { id: "user-1" });

    assert.equal(access.userId, "");
    assert.equal(access.denied, refused.denied);
});

test("сессия без хозяина считается отсутствующей", async () => {
    // Документ сессии без `id` — это порча, а не вход. Пустить по нему значило бы
    // открыть помянник под пустым хозяином, то есть чей-то чужой.
    for (const session of [{}, { id: "" }, { id: 42 }, "user-1"]) {
        const access = userAccess(granted, session);
        assert.equal(access.userId, "", `на ${JSON.stringify(session)}`);
        assert.equal((await access.denied!.json()).error.code, "session_required");
    }
});

test("помянник выдаётся ключам, но не анонимам", () => {
    // Не по дороговизне: за помянником стоит ещё и сессия, а её проверка идёт в
    // базу. Отсутствие раздела в свободном наборе — дешёвые ворота, на которых
    // аноним останавливается, не дойдя до Mongo.
    assert.ok(ALL_SCOPES.includes("pomyannik"));
    assert.ok(!FREE_SCOPES.includes("pomyannik"));
});
