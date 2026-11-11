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

// Сеть полностью подменена: эти проверки не отправляют сообщения в канал.
import {sendChannelPostToTelegram, TelegramSendOptions} from "./telegram";
import type {TelegramDelivery} from "@/types/dto/channelPost";
import {FormData, Response} from "undici";

type Step = (url: string, body: unknown) => Response | Promise<Response>;
const ok = (id: number) => Response.json({ok: true, result: {message_id: id}});
const rejected = (description: string, error_code = 400) => Response.json({ok: false, error_code, description});
const image = () => new Response(new Uint8Array([1, 2, 3]), {headers: {"content-type": "image/webp"}});
const network = (...steps: Step[]) => {
    let count = 0;
    const fetch = (async (url: unknown, init: any) => {
        assert.ok(count < steps.length, `Лишний сетевой запрос: ${url}`);
        return steps[count++](String(url), init?.body);
    }) as TelegramSendOptions["fetch"];
    return {fetch, done: () => assert.equal(count, steps.length)};
};
const post = {text: "<b>Текст поста</b>", imageUrl: " https://images.example/photo.webp "};

test("короткий пост отправляет фотографию файлом с полной HTML-подписью", async () => {
    const net = network(
        (url) => { assert.equal(url, post.imageUrl.trim()); return image(); },
        (url, body) => {
            assert.ok(url.endsWith("/sendPhoto"));
            assert.ok(body instanceof FormData);
            assert.equal(body.get("caption"), post.text);
            assert.equal(body.get("parse_mode"), "HTML");
            assert.equal(body.get("chat_id"), "@channel");
            assert.equal((body.get("photo") as {size: number}).size, 3);
            return ok(10);
        },
    );
    let saved: TelegramDelivery | undefined;
    await sendChannelPostToTelegram(post, "test-token", "channel", {...net, saveDelivery: async d => { saved = d; }});
    assert.equal(saved?.complete, true);
    assert.equal(saved?.photoMessageId, 10);
    net.done();
});

test("длинная подпись сохраняет фото и отправляет полный текст ответом к нему", async () => {
    const text = `<b>${"Длинный текст &amp; ".repeat(100)}</b>`;
    const saved: TelegramDelivery[] = [];
    const net = network(
        () => image(),
        () => rejected("Bad Request: message caption is too long"),
        (url, body) => {
            assert.ok(url.endsWith("/sendPhoto"));
            assert.ok(body instanceof FormData);
            assert.equal(body.has("caption"), false);
            return ok(20);
        },
        (url, body) => {
            assert.ok(url.endsWith("/sendMessage"));
            assert.equal(saved.length, 1); // прогресс сохранён до отправки текста
            const data = JSON.parse(body as string);
            assert.equal(data.text, text);
            assert.deepEqual(data.reply_parameters, {message_id: 20});
            return ok(21);
        },
    );
    await sendChannelPostToTelegram({...post, text}, "test-token", "channel", {...net, saveDelivery: async d => { saved.push(d); }});
    assert.equal(saved[0].complete, false);
    assert.equal(saved[1].complete, true);
    assert.equal(saved[1].messageId, 21);
    net.done();
});

test("повтор после сбоя текста не скачивает и не дублирует уже отправленное фото", async () => {
    let progress: TelegramDelivery | undefined;
    const first = network(
        () => image(),
        () => rejected("Bad Request: message caption is too long"),
        () => ok(30),
        () => rejected("Too Many Requests", 429),
    );
    await assert.rejects(sendChannelPostToTelegram(post, "test-token", "channel", {
        ...first, saveDelivery: async d => { progress = d; },
    }), /Too Many Requests/);
    first.done();
    assert.equal(progress?.photoMessageId, 30);
    const retry = network((url, body) => {
        assert.ok(url.endsWith("/sendMessage"));
        assert.deepEqual(JSON.parse(body as string).reply_parameters, {message_id: 30});
        return ok(31);
    });
    await sendChannelPostToTelegram({...post, telegramDelivery: progress}, "test-token", "channel", {
        ...retry, saveDelivery: async d => { progress = d; },
    });
    retry.done();
    const complete = network();
    await sendChannelPostToTelegram({...post, telegramDelivery: progress}, "test-token", "channel", complete);
    complete.done();
});

test("ошибка фото в Telegram не приводит к незаметной публикации одного текста", async () => {
    const net = network(() => image(), () => rejected("Bad Request: PHOTO_INVALID_DIMENSIONS"));
    await assert.rejects(sendChannelPostToTelegram(post, "test-token", "channel", net), /PHOTO_INVALID_DIMENSIONS/);
    net.done();
});

test("сетевой сбой отправки не приводит к повторной отправке или текстовому посту", async () => {
    const net = network(() => image(), () => { throw new TypeError("fetch failed"); });
    await assert.rejects(sendChannelPostToTelegram(post, "test-token", "channel", net), /fetch failed/);
    net.done();
});

test("недоступная ссылка и пустой файл не публикуют текст без фотографии", async () => {
    for (const response of [new Response(null, {status: 404}), new Response(new Uint8Array())]) {
        const net = network(() => response);
        await assert.rejects(sendChannelPostToTelegram(post, "test-token", "channel", net), /HTTP 404|пуст/);
        net.done();
    }
});

test("временный сбой скачивания фотографии повторяется безопасно", async () => {
    const net = network(() => { throw new TypeError("fetch failed"); }, () => image(), () => ok(40));
    await sendChannelPostToTelegram(post, "test-token", "channel", net);
    net.done();
});

test("после двух ошибок скачивания пост остаётся неотправленным", async () => {
    const net = network(() => new Response(null, {status: 503}), () => new Response(null, {status: 503}));
    await assert.rejects(sendChannelPostToTelegram(post, "test-token", "channel", net), /HTTP 503/);
    net.done();
});

test("пост без картинки отправляется одним текстовым сообщением", async () => {
    const net = network((url, body) => {
        assert.ok(url.endsWith("/sendMessage"));
        assert.equal(JSON.parse(body as string).reply_parameters, undefined);
        return ok(50);
    });
    await sendChannelPostToTelegram({text: post.text}, "test-token", "channel", net);
    net.done();
});

test("если сохранение прогресса не удалось, следующий текст не отправляется", async () => {
    const net = network(
        () => image(),
        () => rejected("Bad Request: message caption is too long"),
        () => ok(60),
    );
    await assert.rejects(sendChannelPostToTelegram(post, "test-token", "channel", {
        ...net, saveDelivery: async () => { throw new Error("database unavailable"); },
    }), /database unavailable/);
    net.done();
});

test("слишком большая фотография не заменяется текстовым постом", async () => {
    const net = network(() => new Response(new Uint8Array(10 * 1024 * 1024 + 1)));
    await assert.rejects(sendChannelPostToTelegram(post, "test-token", "channel", net), /10 МБ/);
    net.done();
});
