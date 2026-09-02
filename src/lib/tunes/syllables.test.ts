import { test } from "node:test";
import assert from "node:assert/strict";
import {
    colonSyllables, hasColonMarkup, parseChantText, splitColons, splitWord,
} from "@/lib/tunes/syllables";

test("колена берутся по косым чертам, когда книга их поставила", () => {
    // Так корпус и печатает стихиру: черта — конец строки, а запятая внутри
    // строки колена не кончает.
    const text = "Храм всесве́тел/ трисо́лнечныя зари́ сый,/ озаря́еши ду́ши";
    assert.deepEqual(splitColons(text), [
        "Храм всесве́тел", "трисо́лнечныя зари́ сый,", "озаря́еши ду́ши",
    ]);
});

test("двойная черта и звёздочка делят так же, как одинарная", () => {
    // Двойной книга помечает последнее колено, звёздочку ставит вместо черты.
    assert.deepEqual(
        splitColons("и умири́ жи́знь на́шу,// я́ко Бла́г"),
        ["и умири́ жи́знь на́шу,", "я́ко Бла́г"],
    );
    assert.deepEqual(splitColons("а́зъ* бу́ки"), ["а́зъ", "бу́ки"]);
});

test("без разметки текст остаётся одним коленом, а не делится по запятым", () => {
    // Запятая колена не кончает, и оба разобранных гласа это показали с разных
    // сторон: у первого она дробит лишнее, у третьего не делит там, где надо.
    const text = "Го́споди, воззва́хъ къ Тебе́, услы́ши мя.";
    assert.deepEqual(splitColons(text), [text]);
    assert.equal(hasColonMarkup(text), false);
    assert.equal(hasColonMarkup("Храм всесве́тел/ зари́ сый"), true);
});

test("слог открытый: согласные между гласными отходят к следующему", () => {
    // «Гос-по-ди» — деление письменное; поётся «Го-спо-ди», и под нотой стоит
    // именно поющийся слог.
    assert.deepEqual(splitWord("Господи"), ["Го", "спо", "ди"]);
    assert.deepEqual(splitWord("услыши"), ["у", "слы", "ши"]);
    // Согласные после последней гласной остаются при ней.
    assert.deepEqual(splitWord("милость"), ["ми", "лость"]);
    assert.deepEqual(splitWord("Храм"), ["Храм"]);
});

test("сонорная закрывает слог, когда за ней есть ещё согласная", () => {
    // «се́-рдце» и «со́-лнце» не выговариваются: «рдц» и «лнц» слога не
    // начинают.
    assert.deepEqual(splitWord("се́рдце"), ["се́р", "дце"]);
    assert.deepEqual(splitWord("со́лнце"), ["со́лн", "це"]);
    assert.deepEqual(splitWord("ца́рствїе"), ["ца́р", "ствї", "е"]);
    // А из одних сонорных сочетание уходит дальше целиком.
    assert.deepEqual(splitWord("волна́"), ["во", "лна́"]);
});

test("ударение и звательце не отрываются от своей гласной", () => {
    // Режем за всей диакритикой: иначе слог начинался бы голым знаком.
    assert.deepEqual(splitWord("Го́споди"), ["Го́", "спо", "ди"]);
    assert.deepEqual(splitWord("а҆́ще"), ["а҆́", "ще"]);
});

test("ударный слог помечен, и знак ищется в самом тексте книги", () => {
    const syllables = colonSyllables("услы́ши мя");
    assert.deepEqual(syllables.map(s => s.text), ["у", "слы́", "ши", "мя"]);
    assert.deepEqual(syllables.map(s => s.stressed), [false, true, false, false]);
});

test("вросшая вария тоже ударение", () => {
    // «ѝ» — это и с приросшим тупым ударением, а не обычная буква.
    assert.equal(colonSyllables("сотворѝ").some(s => s.stressed), true);
});

test("безгласное слово приклеивается к следующему слогу", () => {
    // «къ» отдельной ноты не получает — его и не поют отдельно.
    const syllables = colonSyllables("къ Тебе́");
    assert.deepEqual(syllables.map(s => s.text), ["къТе", "бе́"]);
});

test("границы слов сохраняются после деления на слоги", () => {
    const syllables = colonSyllables("сла́ва Отцу́");
    assert.deepEqual(syllables.map(s => s.wordStart), [true, false, true, false]);
});

test("пунктуация под ноту не идёт, но конец колена запоминается", () => {
    const [colon] = parseChantText("Го́споди,/ воззва́хъ");
    assert.deepEqual(colon.syllables.map(s => s.text), ["Го́", "спо", "ди"]);
    assert.equal(colon.trailing, ",");
});
