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
import {visibleLength} from "./postText";

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

test("длинный пост отправляется одним фото с сокращённой подписью и ссылкой", async () => {
    const text = `<b>${"Длинный текст &amp; ".repeat(100)}</b>`;
    const saved: TelegramDelivery[] = [];
    const net = network(
        () => image(),
        (url, body) => {
            assert.ok(url.endsWith("/sendPhoto"));
            assert.ok(body instanceof FormData);
            const caption = String(body.get("caption"));
            assert.ok(visibleLength(caption) <= 1024);
            assert.match(caption, /<\/b>…/);
            assert.match(caption, /reading\/63c9638ce99d9f4d9010c598/);
            assert.match(caption, /Читать полностью на сайте/);
            return ok(20);
        },
    );
    const input = {...post, text, sourceTextId: "63c9638ce99d9f4d9010c598"};
    await sendChannelPostToTelegram(input, "test-token", "channel", {...net, saveDelivery: async d => { saved.push(d); }});
    assert.equal(saved.length, 1);
    assert.equal(saved[0].complete, true);
    assert.equal(input.text, text);
    net.done();
    const complete = network();
    await sendChannelPostToTelegram({...input, telegramDelivery: saved[0]}, "test-token", "channel", complete);
    complete.done();
});

test("незавершённая отправка прежнего формата дополняет фото подписью без второго поста", async () => {
    let progress: TelegramDelivery | undefined;
    const first = network(() => image(), () => ok(30));
    await sendChannelPostToTelegram(post, "test-token", "channel", {
        ...first, saveDelivery: async d => { progress = {...d, complete: false, messageId: undefined}; },
    });
    first.done();
    const retry = network((url, body) => {
        assert.ok(url.endsWith("/editMessageCaption"));
        assert.equal(JSON.parse(body as string).message_id, 30);
        assert.equal(JSON.parse(body as string).caption, post.text);
        return ok(30);
    });
    await sendChannelPostToTelegram({...post, telegramDelivery: progress}, "test-token", "channel", retry);
    retry.done();
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

test("ошибка сохранения результата не приводит к публикации отдельного текста", async () => {
    const net = network(
        () => image(),
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

test("длинный ручной пост без источника не отправляет фото без ссылки", async () => {
    const net = network();
    await assert.rejects(sendChannelPostToTelegram({...post, text: "слово ".repeat(400)}, "test-token", "channel", net), /добавьте ссылку/);
    net.done();
});
