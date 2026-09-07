import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { CHURCH_FORMS, checkName, lexiconKeys } from "./names";

// Кусок указателя святцев: тест не поднимает базу.
const SVYATTSY = new Set([
    "николай", "георгий", "иоанн", "мария", "дария", "ксения", "фотина",
    "аполлинария", "пелагия", "елисавета", "иулия", "анастасия",
]);

describe("сверка имени", () => {
    it("имя из святцев принимает без подсказок", () => {
        const check = checkName("Николай", SVYATTSY);
        assert.equal(check.status, "known");
        assert.deepEqual(check.suggestions, []);
    });

    it("ударение и «ё» ключу не мешают", () => {
        assert.equal(checkName("Никола́й", SVYATTSY).status, "known");
        assert.equal(checkName("николай", SVYATTSY).name, "Николай");
    });

    it("гражданскому имени предлагает имя наречения", () => {
        const check = checkName("Юрий", SVYATTSY);
        assert.equal(check.status, "civil");
        assert.equal(check.suggestions[0].name, "Георгий");
    });

    it("предлагает несколько имён наречения, а не выбирает за человека", () => {
        const names = checkName("Полина", SVYATTSY).suggestions.map(s => s.name);
        assert.deepEqual(names, ["Аполлинария", "Пелагия"]);
    });

    it("незнакомое имя принимает, а не отвергает", () => {
        const check = checkName("Радмила", SVYATTSY);
        assert.equal(check.status, "unknown");
        assert.equal(check.name, "Радмила", "имя человека остаётся при нём");
    });

    it("на описку подсказывает одно близкое имя", () => {
        const check = checkName("Николаи", SVYATTSY);
        assert.equal(check.status, "unknown");
        assert.deepEqual(check.suggestions, [{ name: "Николай", why: "похоже на описку" }]);
    });

    it("далёкое от святцев именем из них не подменяет", () => {
        assert.deepEqual(checkName("Тимур", SVYATTSY).suggestions, []);
    });

    it("пустое и мусор не выдаёт за имя", () => {
        assert.equal(checkName("", SVYATTSY).status, "unknown");
        assert.equal(checkName("7", SVYATTSY).key, "");
    });
});

describe("таблица наречения", () => {
    it("ключи записаны так же, как считает nameKey", () => {
        for (const key of Object.keys(CHURCH_FORMS)) {
            assert.equal(key, key.toLowerCase(), key);
            assert.ok(!/ё/.test(key), `в ключе «${key}» осталась ё`);
        }
    });

    it("у каждого соответствия сказано, почему так нарекают", () => {
        for (const [key, forms] of Object.entries(CHURCH_FORMS)) {
            assert.ok(forms.length > 0, key);
            for (const form of forms) assert.ok(form.why.length > 5, `${key}: ${form.name}`);
        }
    });
});

describe("ключи церковнославянского словаря", () => {
    it("даёт славянский вид на «-іа» для имён на «-ия»", () => {
        assert.ok(lexiconKeys("Мария").includes("мариа"));
        assert.ok(lexiconKeys("Ксения").includes("ксениа"));
        assert.ok(lexiconKeys("Анастасия").includes("анастасиа"));
    });

    it("снимает «й» и «я» на конце", () => {
        assert.ok(lexiconKeys("Николай").includes("николаи"));
        assert.ok(lexiconKeys("Зоя").includes("зоа"));
    });

    it("первым идёт само набранное имя", () => {
        assert.equal(lexiconKeys("Иоанн")[0], "иоанн");
    });

    it("повторов не выдаёт", () => {
        const keys = lexiconKeys("Пётр");
        assert.equal(keys.length, new Set(keys).size);
    });
});
