import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { APP_HEADER, countV1Request, deprecationHeaders, flushUsage, resetUsage } from "@/lib/api/v1Deprecation";

// Считаем клиентов первой версии, чтобы решать о её закрытии по цифрам, а не на глаз.
// Ошибка в этом счёте означала бы, что v1 закроют, когда старых клиентов ещё много.

const captureFlush = (): any => {
    const original = console.log;
    let captured: any = null;
    console.log = (line: string) => {
        try { captured = JSON.parse(line); } catch { /* не наша строка */ }
    };
    try {
        flushUsage();
    } finally {
        console.log = original;
    }
    return captured;
};

const request = (version?: string) =>
    countV1Request(new Headers(version ? { [APP_HEADER]: version } : {}));

beforeEach(() => resetUsage());

test("считает клиентов с заголовком и без", () => {
    for (let i = 0; i < 6; i++) request("1.5.0+6");
    for (let i = 0; i < 14; i++) request();

    const report = captureFlush();

    assert.equal(report.total, 20);
    assert.equal(report.withApp, 6);
    assert.equal(report.withoutApp, 14);
    assert.equal(report.withoutAppShare, 0.7, "доля старых клиентов считается неверно");
});

test("различает версии приложения", () => {
    request("1.5.0+6");
    request("1.5.0+6");
    request("1.6.0+7");

    const report = captureFlush();

    assert.deepEqual(report.versions, { "1.5.0+6": 2, "1.6.0+7": 1 });
});

test("версия приложения возвращается вызывающему", () => {
    assert.equal(request("1.5.0+6"), "1.5.0+6");
    assert.equal(request(), null);
});

test("после выгрузки счётчик обнуляется", () => {
    request("1.5.0+6");
    captureFlush();

    request();
    const second = captureFlush();

    assert.equal(second.total, 1, "прошлое окно попало в новое");
    assert.equal(second.withApp, 0);
});

test("пустое окно не выводится в лог", () => {
    // Иначе журнал засорялся бы строками «ничего не произошло» каждые пять минут.
    assert.equal(captureFlush(), null);
});

test("слишком длинная версия обрезается", () => {
    // Заголовок присылает клиент, и складывать его в ключи счётчика без ограничения нельзя.
    request("x".repeat(200));
    const report = captureFlush();
    const key = Object.keys(report.versions)[0];
    assert.ok(key.length <= 20, `ключ длиной ${key.length}`);
});

test("заголовки устаревания указывают на замену", () => {
    const headers = deprecationHeaders();

    assert.equal(headers.Deprecation, "true");
    assert.ok(headers.Sunset, "должна быть дата вывода из обращения");
    assert.ok(headers.Link.includes('rel="successor-version"'), "клиент должен узнать, куда переходить");
    assert.ok(headers.Link.includes("/api/v2"));
});
