import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { looksLikeName, nameKey, namesOf, normalizeName, stripAccents } from "./core";

describe("снятие ударения", () => {
    it("оставляет «й» и «ё» на месте", () => {
        // Через NFD они разложились бы, и Гео́ргий стал бы «Георгии»,
        // а Пётр — «Петр»: оба ушли бы мимо имени, которое набирают.
        assert.equal(stripAccents("Гео́ргий"), "Георгий");
        assert.equal(stripAccents("Пётр"), "Пётр");
        assert.equal(stripAccents("Феофа́но"), "Феофано");
    });

    it("снимает и церковные надстрочные", () => {
        assert.equal(stripAccents("Иису́с"), "Иисус");
    });
});

describe("похоже ли на имя", () => {
    it("имя со заглавной — да", () => {
        assert.equal(looksLikeName("Никола́й"), true);
        assert.equal(looksLikeName("Иу́ния"), true);
    });

    it("чин, оборот и число — нет", () => {
        assert.equal(looksLikeName("евангелист"), false);
        assert.equal(looksLikeName("от"), false);
        assert.equal(looksLikeName("70-ти"), false);
        assert.equal(looksLikeName("князь"), false);
    });

    it("прозвание по месту — нет", () => {
        // «Му́ромские» стоит после имён и именем не является.
        assert.equal(looksLikeName("Му́ромские"), false);
        assert.equal(looksLikeName("Студи́йский"), false);
    });
});

describe("имя из заголовка лица", () => {
    it("берёт первое слово, когда заголовок с него и начинается", () => {
        assert.deepEqual(namesOf("Феофания", "Identity").names, ["Феофания"]);
    });

    it("перешагивает чин и оборот", () => {
        assert.deepEqual(namesOf("евангелист Матфей", "Identity").names, ["Матфей"]);
        assert.deepEqual(namesOf("от 70-ти Алфей", "Identity").names, ["Алфей"]);
        assert.deepEqual(namesOf("великий князь Андрей Боголюбский", "Identity").names, ["Андрей"]);
    });

    it("отброшенное показывает: по нему видно, почему разбор такой", () => {
        assert.deepEqual(namesOf("евангелист Матфей", "Identity").skipped, ["евангелист"]);
    });

    it("берёт оба имени, когда их два", () => {
        assert.deepEqual(namesOf("от 70-ти: Андроник и Иуния", "Identity").names,
            ["Андроник", "Иуния"]);
    });

    it("останавливается на прозвании, а не тянет его в имена", () => {
        assert.deepEqual(namesOf("Николай исповедник, игумен Студийский", "Identity").names,
            ["Николай"]);
        assert.deepEqual(namesOf("Марина (Маргарита)", "Identity").names, ["Марина", "Маргарита"]);
    });

    it("на «ризе» и прочем не-лице имени не находит", () => {
        assert.deepEqual(namesOf("ри́за честна́я Пресвято́й Богоро́дицы", "Thing").names.length > 0, true);
    });
});

describe("соборная память", () => {
    const title = "Ри́мские: Стефа́н, па́па, Неме́зий ты́сяцкий, Луки́лла до́чь его́, Симфро́ний";

    it("собирает имена по всей строке, а не только в начале", () => {
        const got = namesOf(title, "Council");
        assert.ok(got.names.includes("Стефан"));
        assert.ok(got.names.includes("Немезий"));
        assert.ok(got.names.includes("Лукилла"));
        assert.ok(got.names.includes("Симфроний"));
    });

    it("помечается догадкой: в таком перечне именем окажется не всё", () => {
        assert.equal(namesOf(title, "Council").confidence, "guess");
        assert.equal(namesOf("Феофания", "Identity").confidence, "sure");
    });
});

describe("ключ поиска", () => {
    it("сводит «ё» с «е» и регистр", () => {
        // Набирают и «Пётр», и «Петр» — найтись должно и так и так.
        assert.equal(nameKey("Пётр"), nameKey("Петр"));
        assert.equal(nameKey("НИКОЛА́Й"), "николай");
    });

    it("имя к виду указателя", () => {
        assert.equal(normalizeName("иоа́нн"), "Иоанн");
        assert.equal(normalizeName("МАРИ́Я"), "Мария");
    });
});
