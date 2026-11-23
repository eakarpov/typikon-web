import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
    DEFAULT_USTAV, displayedDate, menologyHref, monthGrids, parseCivilDate, selectView,
} from "./menology";

const input = { ustav: DEFAULT_USTAV, mode: "civil", style: "gregorian" } as const;
const today = "2026-11-23";

test("гражданский год начинается в январе и включает високосный день", () => {
    const view = selectView({ ...input, year: 2028 }, today, "julian");
    const months = monthGrids(view, "julian");
    assert.equal(view.date, "2028-01-01");
    assert.equal(months.length, 12);
    assert.equal(months[1].days.length, 29);
    assert.equal(months.flatMap(month => month.days).length, 366);
    assert.equal(parseCivilDate("2100-02-29"), null);
});

test("стиль меняет сетку, сохраняя выбранный физический день и границы гражданского года", () => {
    for (const style of ["gregorian", "julian", "revised"] as const) {
        const view = selectView({ ...input, style, date: "2100-03-01" }, today, "julian");
        const dates = monthGrids(view, "julian").flatMap(month => month.days);
        assert.equal(view.date, "2100-03-01");
        assert.equal(dates[0].date, "2100-01-01");
        assert.equal(dates.at(-1)?.date, "2100-12-31");
        assert.equal(new Set(dates.map(day => day.date)).size, 365);
        assert.equal(dates.find(day => day.date === view.date)?.day, displayedDate(view.date, style).day);
        assert.ok(menologyHref(view).includes("date=2100-03-01"));
    }
    assert.equal(displayedDate("2100-03-01", "julian").day, 16);
});

test("церковный год начинает 1 сентября по стилю выбранного устава", () => {
    const before = selectView({ ...input, mode: "church", date: "2026-09-13" }, today, "julian");
    const after = selectView({ ...input, mode: "church", date: "2026-09-14" }, today, "julian");
    const months = monthGrids(after, "julian");
    assert.equal(before.year, 2025);
    assert.equal(after.year, 2026);
    assert.equal(months[0].from, "2026-09-14");
    assert.equal(months.at(-1)?.to, "2027-09-13");
    assert.equal(monthGrids(after, "revised")[0].from, "2026-09-01");
    assert.ok(months.every(month => month.days.length <= 31));
});
