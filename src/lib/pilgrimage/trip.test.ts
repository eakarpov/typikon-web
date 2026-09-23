import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_TRIP_DAYS, parseTripRequest, saveListOf, tripDays } from "./trip";

test("дни поездки включительно, в том числе через Новый год", () => {
    assert.deepEqual(tripDays("2026-12-30", "2027-01-02"), ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
    assert.deepEqual(tripDays("2026-10-01", "2026-10-01"), ["2026-10-01"]);
});

test("перепутанные, неверные и слишком длинные даты отвергаются", () => {
    assert.equal(tripDays("2026-10-05", "2026-10-01"), null);
    assert.equal(tripDays("2026-10-1", "2026-10-05"), null);
    assert.equal(tripDays("2026-01-01", "2026-12-31"), null);
    assert.equal(tripDays("2026-10-01", "2026-10-31")?.length, MAX_TRIP_DAYS);
});

test("перевод часов не сбивает счёт дней", () => {
    // В ночь на 25 октября 2026 Европа переводит часы; дни считаются по UTC.
    assert.equal(tripDays("2026-10-24", "2026-10-26")?.length, 3);
});

test("запрос: остановки с неверным адресом отбрасываются", () => {
    const r = parseTripRequest({ from: "2026-10-01", to: "2026-10-03", stops: [
        { kind: "temple", slug: "hram-1" }, { kind: "temple", slug: "<script>" }, { kind: "house", slug: "a" },
    ] });
    assert.equal(r.ok, true);
    if (r.ok) {
        assert.deepEqual(r.value.stops, [{ kind: "temple", slug: "hram-1" }]);
        assert.equal(r.days.length, 3);
    }
    assert.equal(parseTripRequest({ from: "x", to: "y" }).ok, false);
});

test("список сохранения: дни, остановки и святые без повторов", () => {
    const list = saveListOf(["2026-10-01", "2026-10-02"],
        [{ href: "/temples/a", name: "Храм А" }],
        [{ href: "/saints/s", name: "Святой" }, { href: "/saints/s", name: "Святой" }],
        (d) => d);
    assert.deepEqual(list.map((i) => i.url), ["/calculator/2026-10-01", "/calculator/2026-10-02", "/temples/a", "/saints/s"]);
});
