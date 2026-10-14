import { test } from "node:test";
import assert from "node:assert/strict";
import { churchMonthDay, daySaintsOf } from "./core";

// Святые дня собираются из связок «память → святой». Связи выверены меньше чем
// в половине случаев (88 из 653), поэтому null в связке — обычный случай, а не
// сбой: святой просто не проставлен.

test("церковное число — на тринадцать дней раньше гражданского", () => {
    // Ожидание считается теми же геттерами, что и в функции: сравнение с
    // фиксированной таблицей зависело бы от часового пояса машины, а так тест
    // держит саму договорённость — «ровно минус 13 дней, как в calcDay».
    const civil = "2026-04-12";
    const expected = new Date(new Date(civil).getTime() - 13 * 24 * 3600 * 1000);

    assert.deepEqual(churchMonthDay(civil), {
        month: expected.getMonth() + 1,
        day: expected.getDate(),
    });
});

test("неразобравшаяся дата — null", () => {
    assert.equal(churchMonthDay("не-дата"), null);
});

test("порядок святых — порядок памятей", () => {
    const saints = daySaintsOf([
        { memoryId: "menaion-01-01-1", saint: { slug: "pervyj" } },
        { memoryId: "menaion-01-01-2", saint: { slug: "vtoroj" } },
        { memoryId: "menaion-01-01-3", saint: { slug: "tretij" } },
    ]);

    assert.deepEqual(saints.map((s) => s.slug), ["pervyj", "vtoroj", "tretij"]);
});

test("один святой под несколькими памятями отдаётся один раз", () => {
    // Лицо и перенесение мощей — два номера святцев, одна запись каталога.
    const saints = daySaintsOf([
        { memoryId: "menaion-01-01-1", saint: { slug: "serafim", _id: "a" } },
        { memoryId: "menaion-01-01-2", saint: { slug: "serafim", _id: "a" } },
        { memoryId: "menaion-01-01-3", saint: { slug: "inok", _id: "b" } },
    ]);

    assert.deepEqual(saints.map((s) => s.slug), ["serafim", "inok"]);
});

test("память без выверенной связи пропускается молча", () => {
    const saints = daySaintsOf([
        { memoryId: "menaion-01-01-1", saint: null },
        { memoryId: "menaion-01-01-2", saint: { slug: "est" } },
    ]);

    assert.deepEqual(saints.map((s) => s.slug), ["est"]);
});

test("не-лица не входят в список святых", () => {
    const saints = daySaintsOf([
        { memoryId: "m1", saint: { slug: "lico", type: "Identity" } },
        { memoryId: "m2", saint: { slug: "sobor", type: "Council" } },
        { memoryId: "m3", saint: { slug: "staraya-zapis", type: null } },
        { memoryId: "m4", saint: { slug: "ikona", type: "Thing" } },
        { memoryId: "m5", saint: { slug: "gorod", type: "Place" } },
        { memoryId: "m6", saint: { slug: "khram", type: "Building" } },
    ]);

    assert.deepEqual(
        saints.map((s) => s.slug),
        ["lico", "sobor", "staraya-zapis"],
    );
});

test("записи без слуга не сливаются между собой", () => {
    const saints = daySaintsOf([
        { memoryId: "m1", saint: { _id: "x1", name: "Без слуга 1", type: "Identity" } },
        { memoryId: "m2", saint: { _id: "x2", name: "Без слуга 2", type: "Identity" } },
        { memoryId: "m3", saint: { _id: "x1", name: "Без слуга 1", type: "Identity" } },
    ]);

    assert.deepEqual(saints.map((s) => s.name), ["Без слуга 1", "Без слуга 2"]);
});
