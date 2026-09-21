import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLectionaryYear, getPaschaDate } from "@/utils/lectionaryCycle";

// Числа в этих тестах — не из головы и не из пересказов: каждое снято с Патриаршего
// календаря (зачала дня) либо сказано словами в Богослужебных указаниях
// Издательского совета. Где опоры нет, тест это говорит.

const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const slice = (map: Map<number, number>, from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => map.get(from + i));

test("Пасха считается по известным годам", () => {
    assert.equal(iso(getPaschaDate(2009)), "2009-04-19");
    assert.equal(iso(getPaschaDate(2010)), "2010-04-04");
    assert.equal(iso(getPaschaDate(2024)), "2024-05-05");
    assert.equal(iso(getPaschaDate(2025)), "2025-04-20");
    assert.equal(iso(getPaschaDate(2026)), "2026-04-12");
});

test("Пятидесятница — пятидесятый день от Пасхи", () => {
    for (const year of [2009, 2010, 2024, 2025, 2026, 2031]) {
        const { paschaDate, pentecostDate } = computeLectionaryYear(year);
        const days = Math.round((+pentecostDate - +paschaDate) / (24 * 3600 * 1000));
        assert.equal(days, 49, `${year}: между Пасхой и Пятидесятницей ${days} дней`);
        assert.equal(pentecostDate.getDay(), 0, `${year}: Пятидесятница должна быть воскресеньем`);
    }
});

test("2023: Неделя по Воздвижении — 17-я, сдвига нет", () => {
    // Календарь: 26 и 28 сентября 2023 — зачала 17-й седмицы, 4 октября — 18-й.
    const year = computeLectionaryYear(2023);
    assert.equal(year.elevationWeekNumber, 17);
    assert.deepEqual(year.septemberAdjustment, { kind: "none", weeks: 0 });
    assert.deepEqual(slice(year.gospelWeekMap, 16, 19), [16, 17, 18, 19]);
});

test("2025: преступка на седмицу — Лука с 17-й седмицы, Апостол на месте", () => {
    // Указания, 29.09.2025: «в 17-ю седмицу по Пятидесятнице читаются евангельские
    // чтения 18-й седмицы и апостольские чтения 17-й седмицы».
    const year = computeLectionaryYear(2025);
    assert.equal(iso(year.elevationSunday), "2025-09-28");
    assert.deepEqual(year.septemberAdjustment, { kind: "prestupka", weeks: 1 });
    assert.deepEqual(slice(year.gospelWeekMap, 15, 19), [15, 16, 18, 19, 20]);
    assert.deepEqual(slice(year.apostleWeekMap, 15, 19), [15, 16, 17, 18, 19]);
});

test("2024: преступка на три седмицы — Лука с 15-й", () => {
    // Календарь: 2 и 6 октября 2024 (15-я по счёту) — Евангелие 18-й, Апостол 15-й.
    // Прежняя версия начинала Луку с 14-й и пропускала четыре седмицы.
    const year = computeLectionaryYear(2024);
    assert.equal(year.elevationWeekNumber, 14);
    assert.deepEqual(year.septemberAdjustment, { kind: "prestupka", weeks: 3 });
    assert.deepEqual(slice(year.gospelWeekMap, 13, 17), [13, 14, 18, 19, 20]);
    assert.deepEqual(slice(year.apostleWeekMap, 13, 17), [13, 14, 15, 16, 17]);
});

test("2026: отступка на седмицу — в 18-ю читается 11-я Матфеева", () => {
    // Указания, 28.09.2026: «в седмицу 18-ю по Пятидесятнице читаются евангельские
    // чтения 11-й, Матфеевой, седмицы»; 5.10.2026: «в 19-ю седмицу … евангельские
    // чтения 18-й седмицы и апостольские чтения 19-й». Прежняя версия считала,
    // что в этом году сдвига нет.
    const year = computeLectionaryYear(2026);
    assert.deepEqual(year.septemberAdjustment, { kind: "otstupka", weeks: 1 });
    assert.deepEqual(slice(year.gospelWeekMap, 17, 20), [17, 11, 18, 19]);
    assert.deepEqual(slice(year.apostleWeekMap, 17, 20), [17, 18, 19, 20]);
});

test("2010: отступка на две седмицы — 10-я и 11-я", () => {
    // Опора прежняя (webtypikon.ru), своей сверки на этот год нет: календарь с
    // зачалами лежит с 2022 года.
    const year = computeLectionaryYear(2010);
    assert.deepEqual(year.septemberAdjustment, { kind: "otstupka", weeks: 2 });
    assert.deepEqual(slice(year.gospelWeekMap, 17, 20), [17, 10, 11, 18]);
});

test("крещенская отступка считается от Богоявления СЛЕДУЮЩЕГО года и назад от мытаря", () => {
    // Цикл 2025: Указания — «в седмицу 34-ю … читаются рядовые чтения 33-й»;
    // календарь 20–21 января 2026 (33-я по счёту) — зачала 32-й и Апостола, и
    // Евангелия; 12–13 января (32-я по счёту) — Апостол 32-й, Евангелие 33-й.
    const y2025 = computeLectionaryYear(2025);
    assert.equal(iso(y2025.publicanSunday), "2026-02-01");
    assert.equal(y2025.januaryBlockStart, 33);
    assert.deepEqual(slice(y2025.apostleWeekMap, 31, 34), [31, 32, 32, 33]);
    assert.deepEqual(slice(y2025.gospelWeekMap, 31, 34), [32, 33, 32, 33]);

    // Цикл 2024: Указания — 32-я и 33-я седмицы читают своё; календарь 15 января
    // 2025 (30-я по счёту) — Евангелие 33-й, 22 января (31-я) — уже 31-й.
    const y2024 = computeLectionaryYear(2024);
    assert.deepEqual(slice(y2024.gospelWeekMap, 29, 33), [32, 33, 31, 32, 33]);
    assert.deepEqual(slice(y2024.apostleWeekMap, 29, 33), [29, 30, 31, 32, 33]);
});

test("блок из пяти: 30, 31, о хананеянке, 32, 33", () => {
    // Календарь: 22–23 января 2024 — зачала 30-й седмицы, 7 и 11 февраля — 17-й
    // («Недели 17-й … о хананеянке»), 18 февраля — о Закхее.
    const year = computeLectionaryYear(2023);
    assert.equal(year.publicanWeekNumber, 38);
    assert.deepEqual(slice(year.apostleWeekMap, 33, 38), [33, 30, 31, 17, 32, 33]);
    assert.deepEqual(slice(year.gospelWeekMap, 33, 38), [33, 30, 31, 17, 32, 33]);
});

test("карта покрывает счёт от 1 до Недели о мытаре без дыр и не выходит за 33-ю", () => {
    for (let year = 1990; year <= 2090; year++) {
        const { gospelWeekMap, apostleWeekMap, publicanWeekNumber } = computeLectionaryYear(year);
        for (const map of [gospelWeekMap, apostleWeekMap]) {
            assert.deepEqual([...map.keys()], Array.from({ length: publicanWeekNumber }, (_, i) => i + 1), `${year}`);
            for (const week of map.values()) assert.ok(week >= 1 && week <= 33, `${year}: седмица ${week}`);
        }
        assert.equal(gospelWeekMap.get(publicanWeekNumber), 33, `${year}: перед мытарем — 33-я`);
    }
});

test("пределы сдвигов: преступка до трёх седмиц, отступка до двух, блок от одной до шести", () => {
    for (let year = 1990; year <= 2090; year++) {
        const { septemberAdjustment: a, januaryRepeatWeeks } = computeLectionaryYear(year);
        assert.ok(a.weeks <= (a.kind === "otstupka" ? 2 : 3), `${year}: ${a.kind} ${a.weeks}`);
        assert.ok(januaryRepeatWeeks.length >= 1 && januaryRepeatWeeks.length <= 6, `${year}: блок ${januaryRepeatWeeks.length}`);
    }
});

test("Евангелие не уходит за 33-ю раньше крещенского блока", () => {
    // В доступных годах не встречалось; если встретится, ряд стоит на 33-й, и это
    // место стоит сверить с Указаниями того года.
    const years: number[] = [];
    for (let year = 1990; year <= 2090; year++) {
        const L = computeLectionaryYear(year);
        const natural = 18 + (L.januaryBlockStart - 1 - L.elevationWeekNumber - 1);
        if (natural > 33) years.push(year);
    }
    assert.deepEqual(years, [], `годы, где Евангелие упирается в 33-ю до блока: ${years.join(", ")}`);
});
