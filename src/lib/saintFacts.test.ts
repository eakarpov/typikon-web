import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryDayOf, memoryDaysOf, orderLabel, baseYearLabel, kindLabel } from "@/lib/saintFacts";

// Даты сверены не с кодом перевода, а с самими числами: Пасха 2026 года —
// 12 апреля, 2027-го — 2 мая (александрийская пасхалия); разница стилей в
// нашем веке — тринадцать дней. Ожидания ниже написаны от них.

const TODAY = new Date("2026-09-03T00:00:00Z");

test("постоянное число переводится в гражданский счёт", () => {
    const day = memoryDayOf("16.12", TODAY);
    assert.equal(day?.julian, "16 декабря");
    assert.equal(day?.civil, "29 декабря 2026");
    assert.equal(day?.iso, "2026-12-29");
    assert.equal(day?.note, null);
});

test("прошедшее в этом году число уходит на следующий год", () => {
    // 14 февраля юлианского счёта пришлось на 27 февраля — за полгода до TODAY.
    const day = memoryDayOf("14.02", TODAY);
    assert.equal(day?.civil, "27 февраля 2027");
    assert.equal(day?.iso, "2027-02-27");
});

test("переходящая память считается от Пасхи", () => {
    // +49 — Пятидесятница. В 2026-м она 31 мая и уже прошла, значит показываем
    // 2027 год: Пасха 2 мая, плюс 49 дней — 20 июня.
    const day = memoryDayOf("+49", TODAY);
    assert.equal(day?.julian, null);
    assert.equal(day?.civil, "20 июня 2027");
    assert.equal(day?.note, "49-й день по Пасхе");
});

test("+0 — сама Пасха, и это сказано словами", () => {
    const day = memoryDayOf("+0", TODAY);
    assert.equal(day?.civil, "2 мая 2027");
    assert.equal(day?.note, "сама Пасха");
});

test("отрицательное смещение — до Пасхи", () => {
    // −7 от Пасхи 2027 года: вход Господень в Иерусалим, 25 апреля.
    const day = memoryDayOf("-7", TODAY);
    assert.equal(day?.civil, "25 апреля 2027");
});

test("привязка `%` — первый такой день недели с этого числа", () => {
    // 08.09%0 у святцев значит «первое воскресенье с 8 сентября» (счёт дней
    // недели у них от воскресенья). 8 сентября юлианского — 21 сентября
    // гражданского, понедельник; ближайшее воскресенье — 27 сентября.
    const day = memoryDayOf("08.09%0", TODAY);
    assert.equal(day?.julian, "8 сентября");
    assert.equal(day?.civil, "27 сентября 2026");
    assert.equal(day?.note, "первое воскресенье с этого числа");

    // Род у дней недели разный, и подпись обязана его держать: «первая суббота»,
    // а не «первое суббота» (17.12%6 стоит у памяти Христа).
    assert.equal(memoryDayOf("17.12%6", TODAY)?.note, "первая суббота с этого числа");
});

test("непроверенные привязки не получают гражданской даты", () => {
    // `<`, `>` и `~` в каталоге не встречаются ни разу, и правило их знаков мы
    // не сверяли. Число называем, день — нет: посчитать непроверенное хуже,
    // чем не считать вовсе.
    const day = memoryDayOf("08.09<0", TODAY);
    assert.equal(day?.julian, "8 сентября");
    assert.equal(day?.civil, null);
    assert.equal(day?.iso, null);
});

test("неразобранное — null, а не выдуманный день", () => {
    assert.equal(memoryDayOf("мусор", TODAY), null);
    assert.equal(memoryDayOf("", TODAY), null);
    assert.equal(memoryDayOf("32.01", TODAY), null);
    assert.equal(memoryDayOf("01.13", TODAY), null);
});

test("список идёт по порядку ближайшего наступления", () => {
    const days = memoryDaysOf(["16.12", "+49", "14.02", "мусор"], TODAY);
    assert.deepEqual(days.map((d) => d.iso), ["2026-12-29", "2027-02-27", "2027-06-20"]);
});

test("чин разворачивается словарём святцев, незнакомый код остаётся собой", () => {
    assert.equal(orderLabel("блгв"), "благоверный");
    assert.equal(orderLabel("мчч"), "мученики");
    // Кода нет в семенах святцев — показываем как есть, а не гадаем.
    assert.equal(orderLabel("прдм"), "прдм");
});

test("опорный год: до Рождества — словами, служебные значения — молчанием", () => {
    assert.equal(baseYearLabel(893), "893");
    assert.equal(baseYearLabel(-1001), "1001 до Р. Х.");
    // Числа около -9999 у святцев значат «прежде времени», а не год: -9999 у
    // Троицы, -9998 у Христа. А -5500 у «Мира» — их настоящий счёт от сотворения.
    assert.equal(baseYearLabel(-9999), null);
    assert.equal(baseYearLabel(-9998), null);
    assert.equal(baseYearLabel(-5500), "5500 до Р. Х.");
    assert.equal(baseYearLabel(0), null);
    assert.equal(baseYearLabel(null), null);
});

test("вид записи подписывается только там, где он что-то прибавляет", () => {
    assert.equal(kindLabel("Council"), "собор святых");
    assert.equal(kindLabel("Identity"), null);
    assert.equal(kindLabel(null), null);
});
