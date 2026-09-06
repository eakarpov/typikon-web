import test from "node:test";
import assert from "node:assert/strict";
import { csNumeral, toCyrillicNumeral } from "@/lib/csEncoding/numerals";

test("цифирь читается суммой, второй десяток наоборот", () => {
    assert.equal(csNumeral("ѳ҃і"), 19);
    assert.equal(csNumeral("а҃і"), 11);
    assert.equal(csNumeral("к҃а"), 21);
    assert.equal(csNumeral("р҃кѳ"), 129);
});

test("ук читается во всех четырёх написаниях", () => {
    // До сведения таблиц не читалось ни одно, кроме «у», — при том что ступень
    // hip8 сама производит «ѹ» из «_у».
    for (const uk of ["у҃", "ꙋ҃", "ѹ҃", "ᲂу҃"]) {
        assert.equal(csNumeral(uk), 400, `не прочлось: ${uk}`);
    }
});

test("знак тысячи — только там, где его разрешили", () => {
    // Годы с титульного листа Ифики: разница ровно 5508, то есть эры сошлись.
    const ot = csNumeral("҂зсо҃в", { thousands: true, sign: "titlo" });
    const rzh = csNumeral("҂аѱѯ҃д", { thousands: true, sign: "titlo" });
    assert.equal(ot, 7272);
    assert.equal(rzh, 1764);
    assert.equal(ot! - rzh!, 5508);
    // Строгому разбору номеров стихов знак тысячи не разрешён — и «҂а» для него
    // не число, а строка со знаком, которого он не знает.
    assert.equal(csNumeral("҂а҃", { strict: true }), null);
});

test("строгость и снисходительность различаются на чужой букве", () => {
    assert.equal(csNumeral("щ҃а", { strict: true }), null);
    assert.equal(csNumeral("щ҃а"), 1);
});

test("признак числа: титло против любой пометы", () => {
    // Звательце — не титло: разбору HIP «а҆зъ» число не напоминает.
    assert.equal(csNumeral("а҆", { sign: "titlo" }), null);
    assert.equal(csNumeral("а҆", { sign: "marks" }), 1);
    assert.equal(csNumeral("ми"), null);
    assert.equal(csNumeral(""), null);
});

test("цифирь пишется обратно и читается собою же", () => {
    assert.equal(toCyrillicNumeral(1), "а҃");
    assert.equal(toCyrillicNumeral(11), "а҃і");
    assert.equal(toCyrillicNumeral(1764), "҂аѱѯ҃д");
    // Семьдесят печатаем ѻ: в собрании «ѻ҃» стоит в 72 текстах против 6 с «о҃».
    // Титульный лист Ифики набран узким о — и читается он тем же числом.
    assert.equal(toCyrillicNumeral(7272), "҂зсѻ҃в");
    assert.equal(csNumeral("҂зсо҃в", { thousands: true, sign: "titlo" }), 7272);
    assert.equal(toCyrillicNumeral(0), "");

    // Круговой прогон разом проверяет и таблицу, и правило тысяч, и перевёртыш
    // второго десятка: десять тысяч случаев в три строки.
    for (let n = 1; n <= 10_000; n++) {
        const written = toCyrillicNumeral(n);
        assert.equal(csNumeral(written, { thousands: true, sign: "titlo" }), n,
            `${n} записалось как «${written}» и прочлось иначе`);
    }
});
