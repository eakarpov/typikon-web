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

test("до подготовительных недель отсчёт идёт от прошлой Пасхи", () => {
    // Раньше, чем за 49 дней до Пасхи, — это ещё год предыдущего пасхального круга.
    const result = getWeekAndDay(shift(PASCHA, -60), PASCHA, PREV_PASCHA);
    assert.ok(["first", "Penticostarion"].includes(result.type), `неожиданный тип: ${result.type}`);
    assert.equal(result.pentecostAnchorYear, PREV_PASCHA.getFullYear());
});

test("день недели всегда в допустимых границах", () => {
    for (let offset = -80; offset <= 400; offset += 1) {
        const result = getWeekAndDay(shift(PASCHA, offset), PASCHA, PREV_PASCHA);
        assert.ok(result.day >= 0 && result.day <= 7, `сдвиг ${offset}: день ${result.day}`);
    }
});

test("подготовительные недели Триоди не резолвятся по дате", { todo: "getWeekAndDay не умеет отдавать type Triodion, а в базе все четыре недели лежат как {type: Triodion, value: 0}" }, () => {
    // Весь отрезок от конца пасхального круга до Великого поста — Неделя о мытаре и
    // фарисее, о блудном сыне, мясопустная и сырная седмица — считается продолжением
    // ПРОШЛОГО круга по Пятидесятнице и получает седмицы 34–37, которых в Триоди нет
    // (канонических всего 33). Неделя сыропустная выпадает отдельно: седмица 0 с типом
    // "Fast". В базе все четыре недели лежат как {type: "Triodion", value: 0}
    // (mytaria, bludnogo-syna, strasny-sud, syrnaja), поэтому getTriodicItem, который
    // ищет по паре (value, type), не находит ничего — и на /calculator за эти даты
    // видна только неподвижная часть, хотя тексты есть и открыты через /triodion/{alias}.
    //
    // Починка не сводится к расчёту: у всех четырёх недель value одинаковый, так что
    // различить их по (value, type) нельзя даже при верном типе — нужно решение по данным.
    const pascha = new Date("2026-04-12");
    const prevPascha = new Date("2025-04-20");

    const preparatory = [
        ["2026-02-01", "Неделя о мытаре и фарисее"],
        ["2026-02-08", "Неделя о блудном сыне"],
        ["2026-02-15", "Неделя мясопустная"],
        ["2026-02-22", "Неделя сыропустная"],
    ] as const;

    for (const [date, name] of preparatory) {
        const result = getWeekAndDay(new Date(date), pascha, prevPascha);
        assert.equal(result.type, "Triodion", `${name} (${date}): тип ${result.type}, седмица ${result.week}`);
    }
});
