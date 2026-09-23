import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDistance, parsePoint, summarizeByDedication, type DedicationRow, type NearTempleRow } from "./summary";

test("точка округляется до двух знаков и проверяется на Землю", () => {
    assert.deepEqual(parsePoint("55.75583", "37.61730"), { lat: 55.76, lon: 37.62, radiusKm: 15 });
    assert.equal(parsePoint("91", "0"), null);
    assert.equal(parsePoint("0", "181"), null);
    assert.equal(parsePoint("abc", "1"), null);
    assert.equal(parsePoint("", "1"), null);
    assert.equal(parsePoint(undefined, "1"), null);
});

test("радиус приводится к допустимому", () => {
    assert.equal(parsePoint("1", "1", "500")!.radiusKm, 50);
    assert.equal(parsePoint("1", "1", "0")!.radiusKm, 15);
    assert.equal(parsePoint("1", "1", "0.2")!.radiusKm, 1);
    assert.equal(parsePoint("1", "1", "30")!.radiusKm, 30);
});

test("расстояние по-человечески", () => {
    assert.equal(formatDistance(0.4), "меньше километра");
    assert.equal(formatDistance(3.25), "3,3 км");
    assert.equal(formatDistance(12.6), "13 км");
});

const nikolai: DedicationRow = {
    slug: "nikolai", short: "Николай Чудотворец", label: "Николая", kind: "svyatogo",
    feasts: [{ month: 12, day: 6, memoryLabel: "Николая" }, { month: 5, day: 9, memoryLabel: "Перенесение мощей" }],
    saints: [{ dneslovId: "1", name: "Николай", slug: "nikolai-mirlikiiskii" }],
};
const uspenie: DedicationRow = {
    slug: "uspenie", short: "Успение", label: "Успения", kind: "bogorodichen",
    feasts: [{ month: 8, day: 15 }], saints: [],
};

const temple = (slug: string, meters: number, prestoly: NearTempleRow["prestoly"]): NearTempleRow =>
    ({ slug, name: slug, latitude: 55, longitude: 37, distance: meters, prestoly });

test("свод считает каждый престол, а утраченный пропускает", () => {
    const rows = summarizeByDedication([
        temple("uspenskii", 1200, [
            { dedication: "uspenie", label: "", isMain: true, status: "approved" },
            { dedication: "nikolai", label: "", isMain: false, status: "pending" },
        ]),
        temple("nikolskii", 5400, [{ dedication: "nikolai", label: "", isMain: true, status: "pending" }]),
        temple("byvshii", 300, [{ dedication: "nikolai", label: "", isMain: true, state: "lost", status: "approved" }]),
    ], [nikolai, uspenie], new Date("2026-09-23T00:00:00Z"));

    // Оба ближе всего в одном храме; тогда вперёд тот, у кого храмов рядом больше.
    assert.deepEqual(rows.map((r) => r.slug), ["nikolai", "uspenie"]);
    const n = rows.find((r) => r.slug === "nikolai")!;
    assert.deepEqual(n.temples.map((t) => t.slug), ["uspenskii", "nikolskii"]);
    assert.equal(n.nearestKm, 1.2);
    assert.equal(n.anyApproved, false);
    assert.deepEqual(n.saints, [{ name: "Николай", slug: "nikolai-mirlikiiskii" }]);
    // 6 декабря по старому стилю — 19 декабря по новому.
    assert.equal(n.next?.date, "2026-12-19");
    assert.equal(rows.find((r) => r.slug === "uspenie")!.anyApproved, true);
});

test("ближайший храм решает порядок", () => {
    const rows = summarizeByDedication([
        temple("a", 9000, [{ dedication: "uspenie", label: "", isMain: true }]),
        temple("b", 2000, [{ dedication: "nikolai", label: "", isMain: true }]),
    ], [nikolai, uspenie], new Date("2026-09-23T00:00:00Z"));
    assert.deepEqual(rows.map((r) => r.slug), ["nikolai", "uspenie"]);
});

test("престол без записи в словаре посвящений не выдумывается", () => {
    const rows = summarizeByDedication([temple("x", 100, [{ dedication: "neizvestnoe", label: "", isMain: true }])],
        [nikolai], new Date("2026-09-23T00:00:00Z"));
    assert.deepEqual(rows, []);
});
