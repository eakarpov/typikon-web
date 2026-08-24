import { test } from "node:test";
import assert from "node:assert/strict";
import { getWeekAndDay } from "@/utils/movableCycle";

// Пасхи 2026 и 2025 годов — опорные точки для всех расчётов ниже.
const PASCHA = new Date(2026, 3, 12);
const PREV_PASCHA = new Date(2025, 3, 20);

const shift = (from: Date, days: number) => {
    const d = new Date(from);
    d.setDate(d.getDate() + days);
    return d;
};

test("сама Пасха — первая седмица, день нулевой", () => {
    assert.deepEqual(getWeekAndDay(PASCHA, PASCHA, PREV_PASCHA), { week: 1, day: 0, type: "Pascha" });
});

test("Светлая седмица считается днями от Пасхи", () => {
    assert.deepEqual(getWeekAndDay(shift(PASCHA, 1), PASCHA, PREV_PASCHA), { week: 1, day: 1, type: "Pascha" });
    assert.deepEqual(getWeekAndDay(shift(PASCHA, 6), PASCHA, PREV_PASCHA), { week: 1, day: 6, type: "Pascha" });
});

test("следующее воскресенье — вторая седмица", () => {
    const result = getWeekAndDay(shift(PASCHA, 7), PASCHA, PREV_PASCHA);
    assert.equal(result.week, 2);
    assert.equal(result.day, 0);
    assert.equal(result.type, "Pascha");
});

test("пятидесятый день ещё относится к Пасхе, пятьдесят первый — уже нет", () => {
    assert.equal(getWeekAndDay(shift(PASCHA, 50), PASCHA, PREV_PASCHA).type, "Pascha");

    const afterPentecost = getWeekAndDay(shift(PASCHA, 51), PASCHA, PREV_PASCHA);
    assert.equal(afterPentecost.type, "Penticostarion", "первая седмица по Пятидесятнице — особый тип");
    assert.equal(afterPentecost.week, 1);
});

test("недели со второй по тридцать третью считаются от Пятидесятницы", () => {
    // Ровно тот диапазон, на котором /api/calc когда-то отдавал 400.
    for (let week = 2; week <= 33; week++) {
        const date = shift(PASCHA, 50 + (week - 1) * 7);
        const result = getWeekAndDay(date, PASCHA, PREV_PASCHA);

        assert.equal(result.week, week, `седмица ${week} посчиталась как ${result.week}`);
        assert.equal(result.type, "first", `седмица ${week} получила тип ${result.type}`);
        assert.ok(result.pentecostAnchorYear, `у седмицы ${week} нет года привязки`);
    }
});

test("Великий пост считается назад от Пасхи", () => {
    const result = getWeekAndDay(shift(PASCHA, -7), PASCHA, PREV_PASCHA);
    assert.equal(result.type, "Fast");
    assert.ok(result.week >= 1 && result.week <= 7, `седмица поста вне диапазона: ${result.week}`);
});

test("до Триоди отсчёт идёт от прошлой Пасхи", () => {
    // Раньше, чем за 70 дней до Пасхи (то есть до Недели о мытаре и фарисее),
    // идёт ещё круг по Пятидесятнице предыдущего года.
    const result = getWeekAndDay(shift(PASCHA, -80), PASCHA, PREV_PASCHA);
    assert.ok(["first", "Penticostarion"].includes(result.type), `неожиданный тип: ${result.type}`);
    assert.equal(result.pentecostAnchorYear, PREV_PASCHA.getFullYear());
});

test("день недели всегда в допустимых границах", () => {
    for (let offset = -80; offset <= 400; offset += 1) {
        const result = getWeekAndDay(shift(PASCHA, offset), PASCHA, PREV_PASCHA);
        assert.ok(result.day >= 0 && result.day <= 7, `сдвиг ${offset}: день ${result.day}`);
    }
});

test("подготовительный период Триоди резолвится по дате", () => {
    // Раскладка после fix-triodion-preparatory-weeks: неделя о мытаре одна (0),
    // 34-я седмица вместе с Неделей о блудном сыне (1), мясопустная (2), сырная (3).
    // Дни: понедельник 1 … суббота 6, воскресенье 7.
    const pascha = new Date("2026-04-12");
    const prevPascha = new Date("2025-04-20");
    const at = (date: string) => getWeekAndDay(new Date(date), pascha, prevPascha);

    assert.deepEqual(at("2026-02-01"), { week: 0, day: 7, type: "Triodion" }, "Неделя о мытаре и фарисее");
    assert.deepEqual(at("2026-02-02"), { week: 1, day: 1, type: "Triodion" }, "понедельник 34-й седмицы");
    assert.deepEqual(at("2026-02-07"), { week: 1, day: 6, type: "Triodion" }, "суббота 34-й седмицы");
    assert.deepEqual(at("2026-02-08"), { week: 1, day: 7, type: "Triodion" }, "Неделя о блудном сыне");
    assert.deepEqual(at("2026-02-09"), { week: 2, day: 1, type: "Triodion" }, "понедельник мясопустной");
    assert.deepEqual(at("2026-02-15"), { week: 2, day: 7, type: "Triodion" }, "Неделя мясопустная");
    assert.deepEqual(at("2026-02-16"), { week: 3, day: 1, type: "Triodion" }, "понедельник сырной");
    assert.deepEqual(at("2026-02-22"), { week: 3, day: 7, type: "Triodion" }, "Неделя сыропустная");
});

test("границы подготовительного периода не наезжают на соседей", () => {
    const pascha = new Date("2026-04-12");
    const prevPascha = new Date("2025-04-20");
    const at = (date: string) => getWeekAndDay(new Date(date), pascha, prevPascha);

    // Днём раньше Недели о мытаре — ещё прошлый круг по Пятидесятнице, последняя
    // каноническая седмица.
    const before = at("2026-01-25");
    assert.equal(before.type, "first");
    assert.equal(before.week, 33);

    // Сразу после Недели сыропустной начинается пост, без пропусков и без седмицы 0.
    assert.deepEqual(at("2026-02-23"), { week: 1, day: 1, type: "Fast" }, "Чистый понедельник");
    assert.deepEqual(at("2026-04-11"), { week: 7, day: 6, type: "Fast" }, "Страстная суббота");
});

test("подготовительный период считается одинаково в любой год", () => {
    // Он привязан к Пасхе жёстко: мытарь ровно за 70 дней, сыропустная за 49.
    for (const year of [2024, 2025, 2026, 2027]) {
        const pascha = new Date(Date.UTC(year, 0, 1));
        // Берём произвольную опорную «Пасху» — важно лишь расстояние в днях.
        const shiftDays = (days: number) => new Date(+pascha + days * 24 * 3600 * 1000);

        assert.deepEqual(
            getWeekAndDay(shiftDays(-70), pascha, shiftDays(-365)),
            { week: 0, day: 7, type: "Triodion" },
            `${year}: Неделя о мытаре`,
        );
        assert.deepEqual(
            getWeekAndDay(shiftDays(-49), pascha, shiftDays(-365)),
            { week: 3, day: 7, type: "Triodion" },
            `${year}: Неделя сыропустная`,
        );
    }
});
