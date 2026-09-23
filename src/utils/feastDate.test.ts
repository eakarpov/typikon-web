import { test } from "node:test";
import assert from "node:assert/strict";
import { feastDate, feastsBetween, nextFeast } from "./feastDate";

const iso = (d: Date | null | undefined) => d?.toISOString().slice(0, 10);

test("неподвижный праздник — старый стиль плюс тринадцать дней", () => {
    assert.equal(iso(feastDate({ month: 12, day: 6 }, 2026)), "2026-12-19");
});

test("подвижный считается от Пасхи того года", () => {
    // Пасха 2027 — 2 мая, Троица — через 49 дней.
    assert.equal(iso(feastDate({ paschaOffset: 49 }, 2027)), "2027-06-20");
});

test("ближайший праздник: прошедший в этом году берётся из следующего", () => {
    const n = nextFeast([{ month: 5, day: 9 }, { month: 12, day: 6 }], new Date("2026-12-20T00:00:00Z"));
    assert.equal(iso(n?.date), "2027-05-22");
    const same = nextFeast([{ month: 12, day: 6 }], new Date("2026-12-19T00:00:00Z"));
    assert.equal(iso(same?.date), "2026-12-19");
    assert.equal(nextFeast([{ note: "без даты" }], new Date("2026-01-01T00:00:00Z")), null);
});

test("праздники в промежутке поездки, в том числе через Новый год", () => {
    const hits = feastsBetween([{ month: 12, day: 25 }, { month: 12, day: 6 }],
        new Date("2026-12-15T00:00:00Z"), new Date("2027-01-10T00:00:00Z"));
    assert.deepEqual(hits.map((h) => iso(h.date)), ["2026-12-19", "2027-01-07"]);
});
