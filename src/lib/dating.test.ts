import { test } from "node:test";
import assert from "node:assert/strict";
import * as ch from "@/utils/chronology";
import { circleYear, solve, diagnose, verdict } from "@/lib/dating";

// Испытывать перебор на летописных записях нельзя: там датировка и есть
// предмет спора, подгонка прошла бы незаметно. Записи строятся из счёта, у
// которого ответ известен заранее.

const recordFor = (adYear: number) => {
    const leto = adYear + 5508;
    return {
        indikt: ch.indikt(leto),
        krugSolntsu: ch.krugSolntsu(leto),
        krugLune: ch.krugLune(leto),
    };
};

test("два круга дают единственный год в окне великого индиктиона", () => {
    for (let year = 1941; year <= 2472; year += 7) {
        const leto = year + 5508;
        const result = solve(
            { krugSolntsu: ch.krugSolntsu(leto), krugLune: ch.krugLune(leto) },
            1941, 2472);
        assert.equal(result.survivors.length, 1, `${year}`);
        assert.equal(ch.jdnToGregorian(result.survivors[0].span.first).year, year);
    }
});

test("в окне шире 532 лет те же круги обязаны повториться", () => {
    // Круги замыкаются: запись, назвавшая только их, датирует себя лишь с
    // точностью до великого индиктиона. Единственный ответ здесь означал бы,
    // что перебор молча отбросил законных кандидатов.
    const leto = 2000 + 5508;
    const result = solve(
        { krugSolntsu: ch.krugSolntsu(leto), krugLune: ch.krugLune(leto) }, 1000, 2472);
    assert.ok(result.survivors.length > 1);
    assert.ok(result.survivors.some(
        c => ch.jdnToGregorian(c.span.first).year === 2000));
});

test("три круга сходятся в один год и в окне много шире", () => {
    const result = solve(recordFor(1204), 500, 2500);
    assert.equal(result.survivors.length, 1);
    assert.equal(ch.jdnToGregorian(result.survivors[0].span.first).year, 1204);
});

test("испорченная запись не находится, а поправка указывает на верный год", () => {
    const whole = recordFor(1204);
    const spoiled = { ...whole, indikt: (whole.indikt % 15) + 1 };
    const result = solve(spoiled, 1100, 1300);
    assert.equal(result.survivors.length, 0);
    assert.equal(verdict(result).kind, "none");

    const fixes = diagnose(spoiled, 1100, 1300);
    assert.ok(fixes.length > 0);
    // Меньшая поправка идёт первой, и это она: описка на единицу в индикте.
    assert.equal(fixes[0].field, "indikt");
    assert.equal(fixes[0].needed, whole.indikt);
    assert.equal(fixes[0].size, 1);
    assert.equal(ch.jdnToGregorian(fixes[0].candidate.span.first).year, 1204);
});

test("день недели отсекает счёт, которого запись не подразумевала", () => {
    const record = { leto: 6712, month: 3, day: 5, weekday: "среда" as const };
    const result = solve(record, 1100, 1300);
    // Чтений эры три, а кандидатов два: мартовский с сентябрьским на мартовском
    // числе дают один и тот же день и сведены в одного.
    assert.equal(result.considered, 2);
    assert.equal(result.survivors.length, 1);
    assert.deepEqual(result.survivors[0].styles, ["ultramartovskiy"]);
});

test("мартовский с сентябрьским сводятся: год круга у них общий всегда", () => {
    // Внутри обоих лежит одно и то же 1 марта, а значит и все семь чисел года
    // совпадают по определению. Показывать их порознь — выдавать одно чтение
    // за два.
    for (let leto = 6000; leto < 7600; leto += 7) {
        const marks = (style: ch.EraStyle) =>
            ch.yearMarks(circleYear(ch.letoSpan(leto, style))).leto;
        assert.equal(marks("martovskiy"), marks("sentyabrskiy"), `лето ${leto}`);
        assert.equal(marks("ultramartovskiy"), marks("martovskiy") - 1, `лето ${leto}`);
    }
    // Без числа месяца различать их нечем — кандидат остаётся один на двоих.
    const bare = solve({ leto: 6712 }, 1100, 1300);
    assert.equal(bare.considered, 2);
    assert.deepEqual(bare.candidates[0].styles, ["martovskiy", "sentyabrskiy"]);
});

test("на сентябре–феврале счета расходятся и сводить их уже нельзя", () => {
    // Октябрьское число разводит мартовский счёт с сентябрьским по разным
    // годам, и кандидатов становится трое — теперь это не мнимый выбор.
    const result = solve({ leto: 6712, month: 10, day: 5 }, 1100, 1300);
    assert.equal(result.considered, 3);
    const days = result.candidates.map(c => c.jdn);
    assert.equal(new Set(days).size, 2, "сентябрьский и ультрамартовский дают один день");
});

test("разные лета круга с одним днём остаются разными ответами", () => {
    // Сентябрьский счёт с ультрамартовским на октябрьском числе дают один и
    // тот же день, но РАЗНЫЙ индикт: свести их нельзя — запись, назвавшая
    // индикт, их различит. А если не назвала, день всё равно один, и это
    // ответ, а не неопределённость.
    const result = solve({ leto: 6712, month: 10, day: 5, weekday: "воскресенье" }, 1100, 1300);
    const day = new Set(result.survivors.map(c => c.jdn));
    if (result.survivors.length > 1) {
        assert.equal(day.size, 1);
        assert.equal(verdict(result).kind, "same-day");
        assert.notEqual(result.survivors[0].marks.leto, result.survivors[1].marks.leto);
    }
});

test("несуществующее число отсеивает год само по себе", () => {
    // 29 февраля невисокосного лета — улика, а не повод искать ближайший день.
    const result = solve({ leto: 6711, month: 2, day: 29 }, 1100, 1300);
    assert.ok(result.killedByDate > 0);
});
