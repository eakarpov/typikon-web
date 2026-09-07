import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    between, memorialDays, memorialSaturdays, shift, sorokoustSpan, upcoming,
} from "./reckoning";
import type { PomyannikPerson } from "./types";

const person = (over: Partial<PomyannikPerson>): PomyannikPerson => ({
    id: "1", userId: "u", name: "Николай", nameKey: "николай", churchName: null,
    kind: "departed", sex: null, rank: null, relation: null,
    born: null, baptized: null, died: null, nameDay: null, sorokoust: null,
    groups: [], order: 0, createdAt: new Date(), updatedAt: new Date(), ...over,
});

describe("счёт дней", () => {
    it("сдвигает дату через границу месяца и года", () => {
        assert.equal(shift("2026-02-27", 2), "2026-03-01");
        assert.equal(shift("2026-12-31", 1), "2027-01-01");
        assert.equal(shift("2024-02-28", 1), "2024-02-29", "високосный год");
        assert.equal(shift("не дата", 1), null);
    });

    it("считает сутки между датами", () => {
        assert.equal(between("2026-03-01", "2026-03-10"), 9);
        assert.equal(between("2026-03-10", "2026-03-01"), -9);
    });
});

describe("дни поминовения усопшего", () => {
    // День преставления первый: третий день — через два дня, а не через три.
    it("третий, девятый и сороковой считает от дня преставления как первого", () => {
        const days = memorialDays("2026-03-01", "2026-03-01")!;
        assert.equal(days.third, "2026-03-03");
        assert.equal(days.ninth, "2026-03-09");
        assert.equal(days.fortieth, "2026-04-09");
    });

    it("умерший в понедельник поминается на сороковой день в пятницу", () => {
        // 2 марта 2026 — понедельник, 10 апреля — пятница.
        const days = memorialDays("2026-03-02")!;
        assert.equal(days.fortieth, "2026-04-10");
        assert.equal(new Date("2026-04-10T12:00:00").getDay(), 5);
    });

    it("новопреставленный — сорок дней и ни днём больше", () => {
        assert.equal(memorialDays("2026-03-01", "2026-04-09")!.newlyDeparted, true);
        assert.equal(memorialDays("2026-03-01", "2026-04-10")!.newlyDeparted, false);
    });

    it("полные годы считает по дню, а не по номеру года", () => {
        assert.equal(memorialDays("2019-03-12", "2026-03-11")!.years, 6);
        assert.equal(memorialDays("2019-03-12", "2026-03-12")!.years, 7);
    });
});

describe("сорокоуст", () => {
    it("сорок литургий со дня заказа, а не со дня кончины", () => {
        const span = sorokoustSpan("2026-03-01", "2026-03-01")!;
        assert.equal(span.to, "2026-04-09");
        assert.equal(span.passed, 1, "день заказа — первая литургия");
        assert.equal(span.left, 39);
        assert.equal(span.done, false);
    });

    it("кончается на сороковой день", () => {
        assert.equal(sorokoustSpan("2026-03-01", "2026-04-09")!.done, false);
        assert.equal(sorokoustSpan("2026-03-01", "2026-04-10")!.done, true);
    });
});

describe("поминальные дни года", () => {
    // Пасха 2026 — 12 апреля. Неделя мясопустная 2026-02-15 закреплена
    // в movableCycle.test.ts, значит суббота перед нею — 14 февраля.
    const days2026 = memorialSaturdays(2026);
    const dateOf = (name: string) => days2026.find(d => d.name.startsWith(name))?.date;

    it("подвижные считает от Пасхи", () => {
        assert.equal(dateOf("Суббота мясопустная"), "2026-02-14");
        assert.equal(dateOf("Суббота 2-й"), "2026-03-07");
        assert.equal(dateOf("Суббота 3-й"), "2026-03-14");
        assert.equal(dateOf("Суббота 4-й"), "2026-03-21");
        assert.equal(dateOf("Радоница"), "2026-04-21");
        assert.equal(dateOf("Суббота Троицкая"), "2026-05-30");
    });

    it("все подвижные приходятся на субботу, кроме Радоницы — она вторник", () => {
        for (const name of ["Суббота мясопустная", "Суббота 2-й", "Суббота Троицкая"]) {
            assert.equal(new Date(`${dateOf(name)}T12:00:00`).getDay(), 6, name);
        }
        assert.equal(new Date(`${dateOf("Радоница")}T12:00:00`).getDay(), 2);
    });

    it("Димитриевская — суббота перед 8 ноября", () => {
        assert.equal(dateOf("Суббота Димитриевская"), "2026-11-07");
        // 8 ноября 2025 — суббота; поминают накануне неё, а не в самый день памяти.
        const days2025 = memorialSaturdays(2025);
        assert.equal(days2025.find(d => d.name.startsWith("Суббота Димитриевская"))?.date,
                     "2025-11-01");
    });

    it("неуставные дни помечены, а не выданы за Типикон", () => {
        assert.equal(days2026.find(d => d.date === "2026-05-09")?.custom, true);
        assert.equal(dateOf("Суббота мясопустная") && days2026[0].custom, false);
    });

    it("выдаёт по возрастанию даты", () => {
        const dates = days2026.map(d => d.date);
        assert.deepEqual(dates, [...dates].sort());
    });
});

describe("ближайшее", () => {
    it("собирает именины, годовщину и сороковой день в одну ленту по датам", () => {
        const events = upcoming([
            person({ id: "a", name: "Иоанн", died: "2026-03-01" }),
            person({ id: "b", name: "Мария", kind: "living",
                     nameDay: { source: "auto", month: 4, day: 14 } }),
            person({ id: "c", name: "Пётр", died: "2019-03-12" }),
        ], "2026-03-05", 45);

        const short = events.map(e => `${e.date} ${e.kind}`);
        assert.ok(short.includes("2026-03-09 ninth"), "девятый день Иоанна");
        assert.ok(short.includes("2026-03-12 anniversary"), "годовщина Петра");
        assert.ok(short.includes("2026-04-09 fortieth"), "сороковой день Иоанна");
        assert.ok(short.includes("2026-04-14 nameday"), "именины Марии");
        assert.deepEqual(events.map(e => e.date), [...events.map(e => e.date)].sort());
    });

    it("годовщиной первого года считает не сам день кончины", () => {
        const events = upcoming([person({ died: "2026-03-01" })], "2026-02-25", 10);
        assert.equal(events.filter(e => e.kind === "anniversary").length, 0);
    });

    it("именины старого стиля переводит на каждый год, а не хранит переведёнными", () => {
        // 16 февраля месяцеслова: в 2027-м это 1 марта, в високосном 2028-м —
        // 29 февраля. Заранее посчитанное число тут соврало бы.
        const events = upcoming(
            [person({ kind: "living",
                      nameDay: { source: "auto", style: "old", month: 2, day: 16 } })],
            "2027-01-01", 500);
        assert.deepEqual(events.filter(e => e.kind === "nameday").map(e => e.date),
                         ["2027-03-01", "2028-02-29"]);
    });

    it("подвижные именины считает от Пасхи каждого года окна", () => {
        // Пасха 2026 — 12 апреля, 2027 — 2 мая. Смещение −14 даёт разные числа.
        const events = upcoming(
            [person({ kind: "living", nameDay: { source: "auto", offset: -14 } })],
            "2026-01-01", 730);
        const dates = events.filter(e => e.kind === "nameday").map(e => e.date);
        assert.deepEqual(dates, ["2026-03-29", "2027-04-18"]);
    });

    it("годовые события переходят на следующий год", () => {
        const events = upcoming(
            [person({ kind: "living", nameDay: { source: "auto", month: 1, day: 7 } })],
            "2026-12-20", 30);
        assert.equal(events[0]?.date, "2027-01-07");
    });

    it("добавляет общие поминальные дни без привязки к лицу", () => {
        const events = upcoming([], "2026-04-15", 10);
        const radonitsa = events.find(e => e.kind === "memorial-day");
        assert.equal(radonitsa?.date, "2026-04-21");
        assert.equal(radonitsa?.personId, undefined);
    });

    it("за окно не выходит", () => {
        const events = upcoming([person({ died: "2026-03-01" })], "2026-03-05", 3);
        assert.ok(events.every(e => e.date >= "2026-03-05" && e.date <= "2026-03-08"));
    });
});
