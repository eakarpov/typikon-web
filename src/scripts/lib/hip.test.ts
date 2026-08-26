import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHip, csNumber } from "@/scripts/lib/hip";

const clean = (raw: string) => normalizeHip(raw).content;

test("паразитное титло перед ударением снимается, само титло остаётся", () => {
    // «стра҃́жи»: между гласной и оксией стоит титло, которого в корпусе не бывает.
    assert.equal(clean("стра҃́жи"), "стра́жи");
    // А над согласной в сокращении титло настоящее и не трогается.
    assert.equal(clean("бж҃іей"), "бж҃іей");
});

test("ASCII-заменители ударений становятся варией и каморой", () => {
    assert.equal(clean("любвѐ".normalize("NFD").replace(/̀/, "`")), "любвѐ");
    assert.equal(clean("Пра^вила"), "Пра̑вила");
});

test("латинские подстановки возвращаются в кириллицу", () => {
    assert.equal(clean("фiлосо́фiа"), "філосо́фіа");
    assert.equal(clean("W҆ вѣ́рѣ"), "Ѡ҆ вѣ́рѣ");
    assert.equal(clean("ч҃f"), "ч҃ѳ");
    assert.equal(clean("СЕБJЬ"), "СЕБѢ");
});

test("год издания Ифики читается одинаково от сотворения мира и от Рождества", () => {
    // Титул печатает год дважды: ҂зсо҃в и ҂аѱѯ҃д. Разница должна быть 5508.
    const fromCreation = csNumber(clean("#зсо҃в"));
    const fromNativity = csNumber(clean("#а_пс_кс҃д"));
    assert.equal(fromCreation, 7272);
    assert.equal(fromNativity, 1764);
    assert.equal(fromCreation! - fromNativity!, 5508);
});

test("разрыв строки внутри слова склеивается вплотную, между словами — пробелом", () => {
    assert.equal(clean("пола//га́я"), "полага́я");
    assert.equal(clean("сло́во // моѐ"), "сло́во моѐ");
});

test("границы абзацев переживают склейку строк", () => {
    const raw = "пе́рвый а҆бза́цъ //\n\nвторы́й а҆бза́цъ";
    assert.equal(clean(raw).split(/\n\s*\n/).length, 2);
});

test("сноски уезжают в массив, {комм.} остаётся пометкой", () => {
    const { content, footnotes } = normalizeHip("гл҃ю{маѳ з҃_i} ва́мъ\n\n{комм.}Тolkова́ніе");
    assert.equal(footnotes.length, 1);
    assert.equal(footnotes[0], "маѳ з҃і");
    assert.match(content, /гл҃ю\{1\} ва́мъ/);
    assert.match(content, /\{комм\.\}/);
});

test("колонтитул уходит из потока, но не пропадает", () => {
    assert.equal(clean("а҆по́(с. в҃)столѡвъ"), "а҆по́{p|с. в҃}столѡвъ");
    assert.equal(clean("(л. а҃ ѡ҆б.)"), "{p|л. а҃ ѡ҆б.}");
});

test("шапка OCR и издательская преамбула не попадают в текст", () => {
    const { content, dropped } = normalizeHip(
        "<::лат> OCR:\n\n<::рꙋс> Библиотека\n\n<::слав>\n\nТе́кстъ",
    );
    assert.equal(content, "Те́кстъ");
    assert.equal(dropped.length, 1);
});

test("церковнославянские числа складываются из букв", () => {
    assert.equal(csNumber("а҃"), 1);
    assert.equal(csNumber("а҃і"), 11);
    assert.equal(csNumber("к҃є"), 25);
    assert.equal(csNumber("р҃в"), 102);
    assert.equal(csNumber("ѱп҃г"), 783);
    assert.equal(csNumber("безъ числа̀"), null);
});
