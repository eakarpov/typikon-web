import test from "node:test";
import assert from "node:assert/strict";
import {
    agreement, contextKeys, defaultOf, letterAt, onlyLettersApart, placeLetters, sameGroup,
} from "@/lib/cslav/positional";

const table = {
    "2|∞|аг●": "ѡ",          // родительное «-агѡ»
    "1|∞|ж●мъ": "є",         // дательное множественное «-ємъ»
};

test("умолчание ряда — первая буква", () => {
    assert.equal(defaultOf("ѡ"), "о");
    assert.equal(defaultOf("є"), "е");
    assert.equal(defaultOf("ѣ"), null);
    assert.equal(sameGroup("о", "ѻ"), true);
    assert.equal(sameGroup("о", "є"), false);
});

test("ключи идут от частного к общему", () => {
    const keys = contextKeys("свѧтагѡ", 6);
    assert.equal(keys[0], "2|∞|аг●");
    assert.ok(keys.length > 3);
    // Последний ключ — самый общий: одна буква слева и ничего справа.
    assert.equal(keys[keys.length - 1], "1|0|г●");
});

test("таблица отвечает только за свой ряд", () => {
    // Контекст «●мъ» набран и по омеге, и по є; подменять ряд нельзя.
    assert.equal(letterAt(table, "мꙋжемъ", 3), "є");
    assert.equal(letterAt({ "1|0|ж●": "є" }, "жомъ", 1), null);
});

test("согласие считается только по местам, о которых таблица говорит", () => {
    assert.equal(agreement(table, "свѧтагѡ"), 1);
    assert.equal(agreement(table, "свѧтаго"), 0);
    // Слово без спорных мест, о которых таблица знает, — молчание, а не ноль.
    assert.equal(agreement(table, "рѣка"), null);
});

test("правило прикладывается только к спору одними спорными буквами", () => {
    assert.equal(onlyLettersApart("свѧтаго", "свѧтагѡ"), true);
    assert.equal(onlyLettersApart("мꙋжемъ", "мꙋжємъ"), true);
    // Разнятся ещё и ятем — положение об этом не судит.
    assert.equal(onlyLettersApart("тебе", "тебѣ"), false);
    assert.equal(onlyLettersApart("свѧтаго", "свѧтаго"), false);
});

test("расстановка не сбивается ударением", () => {
    // Знакоместа считаются по буквам: ударение стоит между ними и не сдвигает счёт.
    const got = placeLetters("свѧта́го", table);
    assert.equal(got.form, "свѧта́гѡ");
    assert.equal(got.changed, true);
    assert.equal(placeLetters("рѣка̀", table).changed, false);
});
