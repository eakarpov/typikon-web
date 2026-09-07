import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseLine, parseList } from "./parse";

describe("разбор строки", () => {
    it("голое имя", () => {
        const { person, unparsed } = parseLine("Николай");
        assert.equal(person?.name, "Николай");
        assert.equal(person?.kind, "living");
        assert.deepEqual(unparsed, []);
    });

    it("помету понимает и словом, и сокращением", () => {
        assert.equal(parseLine("Мария, мл.").person?.rank, "mladenets");
        assert.equal(parseLine("Мария, младенца").person?.rank, "mladenets");
        assert.equal(parseLine("Николай, болящий").person?.rank, "bolyashchiy");
        assert.equal(parseLine("Анна, монахиня").person?.rank, "monah");
    });

    it("крест перед датой делает лицо усопшим, ничего не спрашивая", () => {
        const { person } = parseLine("Иоанн, †12.03.2019");
        assert.equal(person?.kind, "departed");
        assert.equal(person?.died, "2019-03-12");
    });

    it("понимает «ум.» и плюс наравне с крестом", () => {
        assert.equal(parseLine("Иоанн, ум. 12.03.2019").person?.died, "2019-03-12");
        assert.equal(parseLine("Иоанн, +12.3.2019").person?.died, "2019-03-12");
    });

    it("день рождения и крещения по своим пометам", () => {
        const { person } = parseLine("Георгий, болящий, р.14.06.1978, кр. 1978-07-20");
        assert.equal(person?.born, "1978-06-14");
        assert.equal(person?.baptized, "1978-07-20");
        assert.equal(person?.rank, "bolyashchiy");
    });

    it("голую дату кладёт по разделу: живому в рождение, усопшему в преставление", () => {
        assert.equal(parseLine("Николай, 14.06.1978", 0, "living").person?.born, "1978-06-14");
        assert.equal(parseLine("Николай, 14.06.1978", 0, "departed").person?.died, "1978-06-14");
    });

    it("непонятое слово кладёт в родство, а строку не теряет", () => {
        const { person, unparsed } = parseLine("Николай, крёстный");
        assert.equal(person?.relation, "крёстный");
        assert.deepEqual(unparsed, []);
    });

    it("несуществующую дату за дату не принимает", () => {
        const { person } = parseLine("Николай, †31.02.2019");
        assert.equal(person?.died, undefined);
        assert.equal(person?.relation, "†31.02.2019");
    });

    it("пол угадывает по окончанию, но не спотыкается о Никиту", () => {
        assert.equal(parseLine("Мария").person?.sex, "f");
        assert.equal(parseLine("Николай").person?.sex, "m");
        assert.equal(parseLine("Никита").person?.sex, "m");
        assert.equal(parseLine("Илия").person?.sex, "m");
    });

    it("пустое и закомментированное пропускает", () => {
        assert.equal(parseLine("").person, null);
        assert.equal(parseLine("   ").person, null);
        assert.equal(parseLine("# мои").person, null);
    });

    it("строку без имени не выдаёт за имя", () => {
        const { person, unparsed } = parseLine("777");
        assert.equal(person, null);
        assert.deepEqual(unparsed, ["777"]);
    });
});

describe("разбор списка", () => {
    it("заголовки разводят имена по разворотам", () => {
        const { lines, count } = parseList(`
о здравии
Николай
Мария, мл.

о упокоении
Иоанн, †12.03.2019
Пётр
`);
        assert.equal(count, 4);
        assert.deepEqual(lines.map(l => l.person?.kind),
                         ["living", "living", "departed", "departed"]);
        assert.equal(lines[3].person?.name, "Пётр");
    });

    it("без заголовка кладёт всех в тот раздел, куда вводят", () => {
        const { lines } = parseList("Иоанн\nПётр", "departed");
        assert.deepEqual(lines.map(l => l.person?.kind), ["departed", "departed"]);
    });

    it("номер строки сохраняет — по нему человек найдёт непонятое", () => {
        const { lines } = parseList("Николай\n\nМария");
        assert.deepEqual(lines.map(l => l.line), [1, 3]);
    });

    it("длинный список обрезает и говорит об этом", () => {
        const { count, truncated } = parseList(
            Array.from({ length: 250 }, () => "Николай").join("\n"));
        assert.equal(count, 200);
        assert.equal(truncated, true);
    });
});
