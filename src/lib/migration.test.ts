import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { legacyHostHeaders, migrationEvent } from "@/lib/migration";
import { buildCalendar } from "@/lib/ical";
import { LEGACY_HOST, SITE_HOST } from "@/utils/site";

describe("заголовки для старого адреса", () => {
    it("состоят из одной латиницы", () => {
        // Значение заголовка — ByteString: всё выше 255 в него не лезет. Русская
        // фраза здесь уронила КАЖДЫЙ запрос к API пятисотой ошибкой, и поймано
        // это было только проверкой живого ответа. Больше — тестом.
        for (const [name, value] of Object.entries(legacyHostHeaders())) {
            for (const char of value) {
                assert.ok(
                    char.charCodeAt(0) <= 255,
                    `${name}: знак «${char}» (${char.charCodeAt(0)}) в заголовок не поместится`,
                );
            }
        }
    });

    it("называют срок и преемника", () => {
        const headers = legacyHostHeaders();
        assert.match(headers.Sunset, /^\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/);
        assert.match(headers.Link, new RegExp(`<https://[^>]*${SITE_HOST}>; rel="successor-version"`));
    });
});

describe("событие о переезде в лентах", () => {
    const event = migrationEvent();

    it("имеет постоянный опознаватель", () => {
        // Иначе у подписчика накопится по событию на каждое обновление ленты.
        assert.equal(event.uid, migrationEvent().uid);
        assert.ok(event.uid.includes("@"));
    });

    it("называет оба адреса: куда идти и откуда уходим", () => {
        const text = `${event.summary} ${event.description}`;
        assert.ok(text.includes(SITE_HOST), "не сказано, куда переехали");
        assert.ok(text.includes(LEGACY_HOST), "не сказано, какой адрес отключается");
    });

    it("стоит днём отключения, а не задним числом", () => {
        assert.equal(event.date, "20270115");
    });
});

describe("событие доходит до подписчика целым", () => {
    // Ленту целиком локально не собрать — она считает сотню дней движком устава,
    // которого на машине разработчика нет. Зато можно проверить то, что от неё
    // зависит: переживает ли событие сборку iCalendar. Описание у него длинное и
    // с запятыми, а в этом формате и то, и другое — повод для ошибки: запятая в
    // тексте разделяет значения, а строка длиннее 75 октетов обязана сворачиваться.
    const body = buildCalendar({
        name: "Проверка",
        description: "Проверка",
        events: [migrationEvent()],
        stamp: new Date("2026-09-17T12:00:00.000Z"),
    });

    it("выходит одним событием с суточной датой", () => {
        assert.equal((body.match(/BEGIN:VEVENT/g) ?? []).length, 1);
        assert.ok(body.includes("DTSTART;VALUE=DATE:20270115"), "дата события потерялась");
        assert.ok(body.includes(`UID:${migrationEvent().uid}`), "опознаватель потерялся");
    });

    it("запятые в описании экранированы, а строки свёрнуты", () => {
        const lines = body.split("\r\n");
        // Сырая запятая в тексте разделила бы значение надвое.
        const description = lines.find((line) => line.startsWith("DESCRIPTION:"));
        assert.ok(description, "описания нет вовсе");
        assert.ok(!/[^\\],/.test(description!), "в описании осталась неэкранированная запятая");
        // RFC 5545: строка не длиннее 75 октетов, продолжение начинается пробелом.
        for (const line of lines) {
            assert.ok(
                Buffer.byteLength(line, "utf8") <= 75,
                `строка длиннее 75 октетов: ${line.slice(0, 40)}…`,
            );
        }
    });
});
