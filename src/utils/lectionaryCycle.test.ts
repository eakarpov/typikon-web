import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLectionaryYear, getPaschaDate } from "@/utils/lectionaryCycle";

const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Даты православной Пасхи известны независимо от нашего кода — на них и проверяем,
// иначе тест сверял бы библиотеку сама с собой.
test("Пасха считается по известным годам", () => {
    assert.equal(iso(getPaschaDate(2009)), "2009-04-19");
    assert.equal(iso(getPaschaDate(2010)), "2010-04-04");
    assert.equal(iso(getPaschaDate(2024)), "2024-05-05");
    assert.equal(iso(getPaschaDate(2025)), "2025-04-20");
    assert.equal(iso(getPaschaDate(2026)), "2026-04-12");
});

test("Пятидесятница — пятидесятый день от Пасхи", () => {
    for (const year of [2009, 2010, 2024, 2025, 2026]) {
        const { paschaDate, pentecostDate } = computeLectionaryYear(year);
        const days = Math.round((+pentecostDate - +paschaDate) / (24 * 3600 * 1000));
        assert.equal(days, 49, `${year}: между Пасхой и Пятидесятницей ${days} дней`);
        assert.equal(pentecostDate.getDay(), 0, `${year}: Пятидесятница должна быть воскресеньем`);
    }
});

// Пример из комментария в самом lectionaryCycle.ts: в 2010 году отступка на одну седмицу,
// позиция 18 читает зачало 10-й недели, позиция 19 (Неделя по Воздвижении) — 11-й,
// и только позиция 20 берёт настоящую 18-ю.
test("2010: отступка сдвигает зачала ровно так, как описано", () => {
    const year = computeLectionaryYear(2010);

    assert.deepEqual(year.septemberAdjustment, { kind: "otstupka", weeks: 1 });
    assert.equal(year.gospelWeekMap.get(17), 17);
    assert.equal(year.gospelWeekMap.get(18), 10);
    assert.equal(year.gospelWeekMap.get(19), 11);
    assert.equal(year.gospelWeekMap.get(20), 18);
});

test("2009: преступка пропускает седмицу", () => {
    const year = computeLectionaryYear(2009);

    assert.deepEqual(year.septemberAdjustment, { kind: "prestupka", weeks: 1 });
    assert.equal(year.gospelWeekMap.get(16), 16);
    // 17-я позиция сразу берёт 18-ю неделю — 17-я канонически пропущена.
    assert.equal(year.gospelWeekMap.get(17), 18);
});

test("карта недель не имеет дыр и начинается с единицы", () => {
    for (const year of [2009, 2010, 2024, 2025, 2026, 2031, 2078]) {
        const { gospelWeekMap } = computeLectionaryYear(year);
        const positions = [...gospelWeekMap.keys()].sort((a, b) => a - b);

        assert.equal(positions[0], 1, `${year}: карта должна начинаться с позиции 1`);
        for (let i = 1; i < positions.length; i++) {
            assert.equal(
                positions[i], positions[i - 1] + 1,
                `${year}: разрыв между позициями ${positions[i - 1]} и ${positions[i]}`,
            );
        }
    }
});

test("до позиции сдвига седмицы читаются по порядку", () => {
    // Отступка добавляет лишние позиции только после 17-й, преступка — начинает 18-ю
    // раньше срока. И в том, и в другом случае всё, что идёт до точки сдвига,
    // читается подряд, без перестановок.
    for (const year of [2009, 2010, 2024, 2025, 2026, 2031, 2078]) {
        const { gospelWeekMap } = computeLectionaryYear(year);
        const positions = [...gospelWeekMap.keys()].sort((a, b) => a - b);
        const firstShift = positions.find((p) => gospelWeekMap.get(p) !== p) ?? positions.length + 1;

        for (let week = 1; week < firstShift; week++) {
            assert.equal(gospelWeekMap.get(week), week, `${year}: седмица ${week} сдвинулась`);
        }
    }
});

test("преступка 2024 года пропускает четыре седмицы — фиксация непроверенной гипотезы", () => {
    // В lectionaryCycle.ts ветка преступки помечена как рабочая гипотеза без
    // подтверждающего примера. Тест не утверждает, что так правильно, — он фиксирует,
    // что поведение не изменится незаметно: в 2024 году позиции 14..17 (канонические
    // седмицы 14–17) выпадают целиком, и 18-я начинается с позиции 14.
    const year = computeLectionaryYear(2024);

    assert.deepEqual(year.septemberAdjustment, { kind: "prestupka", weeks: 4 });
    assert.equal(year.gospelWeekMap.get(13), 13);
    assert.equal(year.gospelWeekMap.get(14), 18);
    assert.equal(year.gospelWeekMap.get(15), 19);
});

test("зачала не выходят за 33-ю седмицу", () => {
    for (const year of [2009, 2010, 2024, 2025, 2026, 2031, 2078]) {
        const { gospelWeekMap } = computeLectionaryYear(year);
        for (const [position, canonical] of gospelWeekMap) {
            assert.ok(
                canonical >= 1 && canonical <= 33,
                `${year}: позиция ${position} ссылается на седмицу ${canonical}`,
            );
        }
    }
});

test("апостольская карта пока повторяет евангельскую", () => {
    // Зафиксировано осознанно: в lectionaryCycle.ts стоит TODO о том, что у Апостола
    // свой механизм отступки. Тест должен упасть, когда его наконец разведут —
    // это напоминание, а не утверждение о правильности.
    const { gospelWeekMap, apostleWeekMap } = computeLectionaryYear(2010);
    assert.deepEqual([...apostleWeekMap.entries()], [...gospelWeekMap.entries()]);
});
