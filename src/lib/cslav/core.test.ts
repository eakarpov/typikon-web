import test from "node:test";
import assert from "node:assert/strict";
import { byRule, civilKey, csCanonical, hasChurchSlavonicGraphics, matchCase } from "@/lib/cslav/core";

test("ключ сводит обе стороны к одному виду", () => {
    assert.equal(civilKey("Го́споди"), "господи");
    assert.equal(civilKey("воззва́хъ"), "воззвах");   // конечный ер снимается
    assert.equal(civilKey("воззвах"), "воззвах");
    assert.equal(civilKey("тебѣ̀"), "тебе");
    assert.equal(civilKey("оу҆слы́ши"), "услыши");
    assert.equal(civilKey("ᲂу҆слы́ши"), "услыши");
    assert.equal(civilKey("Гдⷭ҇и"), "гди");           // выносная отбрасывается
});

test("канон сводит начертания, но не выбор буквы", () => {
    // Одна буква, записанная по-разному, — сводится.
    assert.equal(csCanonical("оу҆́бѡ"), csCanonical("ᲂу҆́бѡ"));
    assert.equal(csCanonical("мя̀"), "мѧ̀");
    assert.equal(csCanonical("я҆́кѡ"), "ꙗ҆́кѡ");
    assert.equal(csCanonical("пасᲅырь"), "пастырь");

    // А выбор буквы не трогается: ѡ против о и ѣ против е — это разные
    // написания, и стереть различие значило бы решить спор молча.
    assert.notEqual(csCanonical("є҆гѡ̀"), csCanonical("є҆го̀"));
    assert.notEqual(csCanonical("тебѣ̀"), csCanonical("тебѐ"));
});

test("канон устойчив: повторное приведение ничего не меняет", () => {
    for (const word of ["ᲂу҆́бѡ", "мѧ̀", "ꙗ҆́кѡ", "пастырь", "сїѧ̑"]) {
        assert.equal(csCanonical(csCanonical(word)), csCanonical(word), word);
    }
});

test("правило дописывает то, чего в словаре нет по построению", () => {
    assert.deepEqual(byRule("воззвах"), { form: "воззвахъ", applied: ["ер"] });
    assert.deepEqual(byRule("мя"), { form: "мѧ", applied: ["юс"] });
    assert.equal(byRule("услыши").form, "ᲂу҆слыши");
    assert.deepEqual(byRule("услыши").applied, ["ук", "звательце"]);
    assert.equal(byRule("иже").form, "и҆же");

    // Ер не дописывается после гласной, ь и й.
    assert.deepEqual(byRule("мать").applied, []);
    assert.deepEqual(byRule("святый").applied, ["юс"]);
});

test("правило не восстанавливает ять и омегу", () => {
    // Это и есть граница слоя: «тебе» правилом остаётся «тебе», и слово
    // помечается как непереведённое, а не выдаётся за готовое.
    assert.equal(byRule("тебе").form, "тебе");
    assert.deepEqual(byRule("тебе").applied, []);
    // «его» правило снабдит звательцем, но ни є широкого, ни омеги не даст:
    // в книгах стоит «є҆гѡ̀», а правило доводит только до «е҆го».
    assert.equal(byRule("его").form, "е҆го");
    assert.deepEqual(byRule("его").applied, ["звательце"]);
});

test("регистр возвращается, и диграф ука не портится", () => {
    assert.equal(matchCase("Господи", "господи"), "Господи");
    assert.equal(matchCase("господи", "господи"), "господи");
    // Прописной диграф пишется обычным О: «Оу҆слыши», а не «ᲂу҆слыши».
    assert.equal(matchCase("Услыши", "ᲂу҆слыши"), "Оу҆слыши");
    // Слово целиком прописными — так набраны заголовки книг.
    assert.equal(matchCase("ГОСПОДИ", "господи"), "ГОСПОДИ");
});

test("уже церковнославянское написание опознаётся", () => {
    assert.equal(hasChurchSlavonicGraphics("тебѣ̀"), true);
    assert.equal(hasChurchSlavonicGraphics("Гдⷭ҇и"), true);
    assert.equal(hasChurchSlavonicGraphics("мѧ"), true);
    assert.equal(hasChurchSlavonicGraphics("тебе"), false);
    assert.equal(hasChurchSlavonicGraphics("Господи"), false);
});
