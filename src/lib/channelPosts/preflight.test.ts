import {test} from "node:test";
import assert from "node:assert/strict";
import {Response} from "undici";
import {checkChannelPostForTelegram, TelegramSendOptions} from "./telegram";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");

const setup = (options: {permissions?: boolean; badImage?: boolean; imageStatus?: number; apiFailure?: boolean} = {}) => {
    const methods: string[] = [];
    const fetch = (async (url: unknown, init: any) => {
        const target = String(url);
        if (target === "https://example.org/photo.png") {
            methods.push("download");
            return new Response(options.badImage ? "<html>not a photo</html>" : png, {status: options.imageStatus || 200});
        }
        const method = target.split("/").pop()!;
        // В dry-run ни при каком исходе нельзя вызывать публикующие методы.
        assert.ok(["getMe", "getChat", "getChatMember"].includes(method), `Запрещён вызов ${method}`);
        methods.push(method);
        if (options.apiFailure) return Response.json({ok: false, error_code: 401, description: "Unauthorized"});
        const result = method === "getMe" ? {id: 123} : method === "getChat" ? {id: -100123, type: "channel"} : {status: "administrator", can_post_messages: options.permissions !== false};
        if (method === "getChatMember") assert.equal(JSON.parse(init.body).user_id, 123);
        return Response.json({ok: true, result});
    }) as TelegramSendOptions["fetch"];
    return {fetch, methods};
};
const post = {text: "<b>Новость</b>", imageUrl: "https://example.org/photo.png"};

test("проверка с фото выполняет только скачивание и читающие методы Telegram", async () => {
    const net = setup();
    const result = await checkChannelPostForTelegram(post, "fake-token", "channel", net);
    assert.equal(result.status, "passed");
    assert.equal(result.photo?.format, "png");
    assert.equal(result.textLength, 7);
    assert.deepEqual(net.methods, ["download", "getMe", "getChat", "getChatMember"]);
    assert.deepEqual(post, {text: "<b>Новость</b>", imageUrl: "https://example.org/photo.png"});
});

test("ошибка фотографии останавливает проверку до вызовов Telegram", async () => {
    for (const options of [{badImage: true}, {imageStatus: 404}]) {
        const net = setup(options);
        const result = await checkChannelPostForTelegram(post, "fake-token", "channel", net);
        assert.equal(result.status, "failed");
        assert.deepEqual(net.methods, ["download"]);
        assert.ok(result.error);
    }
});

test("отсутствие прав и неверный токен показываются как ошибки проверки", async () => {
    for (const options of [{permissions: false}, {apiFailure: true}]) {
        const net = setup(options);
        const result = await checkChannelPostForTelegram(post, "fake-token", "channel", net);
        assert.equal(result.status, "failed");
        assert.match(result.error!, /нет права|Unauthorized/);
    }
});

test("без картинки проверяется текст, без отправки сообщения", async () => {
    const net = setup();
    const result = await checkChannelPostForTelegram({text: "Новость"}, "fake-token", "channel", net);
    assert.equal(result.status, "passed");
    assert.equal(result.photo, undefined);
    assert.deepEqual(net.methods, ["getMe", "getChat", "getChatMember"]);
});

test("ошибка подписи возвращается до любых сетевых вызовов", async () => {
    const net = setup();
    const result = await checkChannelPostForTelegram({...post, text: "слово ".repeat(300)}, "fake-token", "channel", net);
    assert.equal(result.status, "failed");
    assert.match(result.error!, /ссылку/);
    assert.deepEqual(net.methods, []);
});
