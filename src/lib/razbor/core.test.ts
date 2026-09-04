import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { flagsOf, readLines, splitLines } from "./core";

describe("разбивка на строки", () => {
    it("выбрасывает пустые, но номер ведёт по исходному тексту", () => {
        // Человек ищет у себя двадцать вторую строку, а не двадцать вторую непустую.
        const got = splitLines("пе́рвая\n\n\nчетвёртая");
        assert.deepEqual(got, [{ n: 1, text: "пе́рвая" }, { n: 4, text: "четвёртая" }]);
    });

    it("обрезает пробелы по краям", () => {
        assert.deepEqual(splitLines("   строка́   "), [{ n: 1, text: "строка́" }]);
    });
});

describe("приметы строки", () => {
    const alone = (line: string) => flagsOf(line, new Map());

    it("видит чужую букву в слове", () => {
        // Латинская C в «Спа́се» — та самая опечатка, что нашлась в подобнах.
        assert.ok(alone("Гро́б Тво́й Cпа́се").includes("mixed-script"));
        assert.ok(!alone("Гро́б Тво́й Спа́се").includes("mixed-script"));
    });

    it("видит отсутствие ударений", () => {
        assert.ok(alone("Господи помилуй нас").includes("no-accents"));
        assert.ok(!alone("Го́споди поми́луй на́с").includes("no-accents"));
    });

    it("видит отсутствие разметки колен", () => {
        assert.ok(alone("Го́споди поми́луй на́с").includes("no-colons"));
        assert.ok(!alone("Го́споди / поми́луй на́с").includes("no-colons"));
    });

    it("коротких строк не ищет", () => {
        assert.ok(alone("Ами́нь").includes("too-short"));
    });

    it("повтор считает по ключу, а не по написанию", () => {
        // «Го́споди, поми́луй» и «Господи помилуй» — одна строка, набранная дважды.
        const lines = readLines("Го́споди, поми́луй на́с\nиная строка́ совсе́м\nГосподи помилуй нас");
        assert.ok(lines[0].flags.includes("repeated"));
        assert.ok(lines[2].flags.includes("repeated"));
        assert.ok(!lines[1].flags.includes("repeated"));
    });
});

describe("ключ зачина", () => {
    it("берёт первые шесть слов и снимает разметку", () => {
        const [line] = readLines("Го́споди, воззва́х к Тебе́, услы́ши мя́, услы́ши мя́, Го́споди");
        assert.equal(line.key, "господи воззвах к тебе услыши мя");
    });
});
