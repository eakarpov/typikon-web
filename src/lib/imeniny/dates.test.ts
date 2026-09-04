import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { civilDate, datesOf, nameDay, parseMemoryDate } from "./dates";

describe("разбор дня памяти", () => {
    it("число месяцеслова", () => {
        assert.deepEqual(parseMemoryDate("01.04"), { kind: "fixed", month: 4, day: 1 });
        assert.deepEqual(parseMemoryDate("16.12"), { kind: "fixed", month: 12, day: 16 });
    });

    it("смещение от Пасхи", () => {
        assert.deepEqual(parseMemoryDate("-14"), { kind: "movable", offset: -14 });
        assert.deepEqual(parseMemoryDate("50"), { kind: "movable", offset: 50 });
    });

    it("мусор отвергает, а не выдумывает дату", () => {
        assert.equal(parseMemoryDate("31.13"), null);
        assert.equal(parseMemoryDate("когда-нибудь"), null);
        assert.equal(parseMemoryDate(""), null);
    });
});

describe("перевод в гражданский календарь", () => {
    it("неподвижную память сдвигает на тринадцать дней", () => {
        assert.equal(civilDate({ kind: "fixed", month: 12, day: 16 }, 2026), "2026-12-29");
        assert.equal(civilDate({ kind: "fixed", month: 4, day: 1 }, 2026), "2026-04-14");
    });

    it("подвижную считает от Пасхи своего года", () => {
        // Пасха 2026 — 12 апреля; за две недели до неё — 29 марта.
        assert.equal(civilDate({ kind: "movable", offset: -14 }, 2026), "2026-03-29");
        // В другой год та же память придётся на другое число — в этом и суть.
        assert.notEqual(civilDate({ kind: "movable", offset: -14 }, 2027),
            civilDate({ kind: "movable", offset: -14 }, 2026));
    });

    it("раскладывает все даты записи и помечает подвижные", () => {
        const got = datesOf(["01.04", "-14", "мусор"], 2026, "Мария Египетская");
        assert.equal(got.length, 2);
        assert.deepEqual(got.map(g => g.movable), [false, true]);
        assert.equal(got[0].item, "Мария Египетская");
    });
});

describe("правило именин", () => {
    const memories = [
        { date: "2026-02-04", movable: false, item: "Николай Студийский" },
        { date: "2026-05-22", movable: false, item: "Никола Чудотворец" },
        { date: "2026-12-19", movable: false, item: "Никола Чудотворец" },
    ];

    it("берёт ближайшую память после дня рождения", () => {
        assert.equal(nameDay({ month: 3, day: 10 }, memories)?.date, "2026-05-22");
    });

    it("день рождения совпал с памятью — она и есть", () => {
        assert.equal(nameDay({ month: 2, day: 4 }, memories)?.date, "2026-02-04");
    });

    it("родившийся в декабре празднует в январе: год круглый", () => {
        assert.equal(nameDay({ month: 12, day: 25 }, memories)?.date, "2026-02-04");
    });

    it("без памятей ответа не выдумывает", () => {
        assert.equal(nameDay({ month: 1, day: 1 }, []), null);
    });
});
