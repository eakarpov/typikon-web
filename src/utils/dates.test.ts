import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDateISO, getTodayDate, getZeroedNumber } from "@/utils/dates";

// Виджет «сегодня» и главная считают церковную дату: минус 13 дней (старый стиль)
// и переход на следующий день после 15 часов — служба нового дня начинается вечером.
test("церковная дата отстаёт на тринадцать дней", () => {
    assert.equal(formatDateISO(getTodayDate("2026-08-24T10:00:00")), "2026-08-11");
});

test("после пятнадцати часов берётся следующий день", () => {
    assert.equal(formatDateISO(getTodayDate("2026-08-24T16:00:00")), "2026-08-12");
});

test("ровно в пятнадцать часов день ещё не переключается", () => {
    // Граница строгая: переход только когда час БОЛЬШЕ пятнадцати.
    assert.equal(formatDateISO(getTodayDate("2026-08-24T15:00:00")), "2026-08-11");
    assert.equal(formatDateISO(getTodayDate("2026-08-24T15:59:00")), "2026-08-11");
});

test("переход через начало месяца считается верно", () => {
    // 1 марта минус 13 дней — февраль, и в невисокосный год это 16-е.
    assert.equal(formatDateISO(getTodayDate("2026-03-01T10:00:00")), "2026-02-16");
});

test("переход через год считается верно", () => {
    assert.equal(formatDateISO(getTodayDate("2026-01-05T10:00:00")), "2025-12-23");
});

test("високосный февраль не теряется", () => {
    assert.equal(formatDateISO(getTodayDate("2024-03-10T10:00:00")), "2024-02-26");
});

test("числа дополняются нулём", () => {
    assert.equal(getZeroedNumber(1), "01");
    assert.equal(getZeroedNumber(9), "09");
    assert.equal(getZeroedNumber(10), "10");
    assert.equal(getZeroedNumber(31), "31");
});

test("формат даты — YYYY-MM-DD", () => {
    assert.equal(formatDateISO(new Date(2026, 0, 5)), "2026-01-05");
    assert.equal(formatDateISO(new Date(2026, 11, 31)), "2026-12-31");
});
