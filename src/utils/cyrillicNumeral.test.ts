import test from "node:test";
import assert from "node:assert/strict";
import { cyrillicNumeral, splitAtNumeral } from "@/utils/cyrillicNumeral";

test("цифирь читается суммой", () => {
    assert.equal(cyrillicNumeral("ѳ҃і"), 19);   // единица перед десяткой
    assert.equal(cyrillicNumeral("м҃д"), 44);
    assert.equal(cyrillicNumeral("р҃кѳ"), 129);
    assert.equal(cyrillicNumeral("а҃"), 1);
});

test("без титла — не число", () => {
    // Иначе всякое «ми» и «не» читалось бы как цифирь и резало текст по живому.
    assert.equal(cyrillicNumeral("ми"), null);
    assert.equal(cyrillicNumeral("не"), null);
    assert.equal(cyrillicNumeral(""), null);
});

test("чужая буква — не число", () => {
    assert.equal(cyrillicNumeral("щ҃а"), null);
});

test("делит по нужной цифири", () => {
    const got = splitAtNumeral("Слово первое. .ѳ҃і Слово второе", 19);
    assert.deepEqual(got, { before: "Слово первое", after: "Слово второе" });
});

test("цифирь слитно со словом тоже находится", () => {
    const got = splitAtNumeral("Конец стиха. р҃кѳМинуната", 129);
    assert.deepEqual(got, { before: "Конец стиха", after: "Минуната" });
});

test("не та цифирь — не режем", () => {
    assert.equal(splitAtNumeral("Слово. .ѳ҃і Слово", 20), null);
    assert.equal(splitAtNumeral("Слово без цифири вовсе", 19), null);
});

test("нечего оставить с краю — не режем", () => {
    // Цифирь в самом начале или конце значит, что делить нечего.
    assert.equal(splitAtNumeral(".ѳ҃і Слово", 19), null);
});
