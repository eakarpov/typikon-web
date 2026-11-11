import {test} from "node:test";
import assert from "node:assert/strict";
import {photoCaption} from "./photoCaption";
import {visibleLength} from "./postText";

const sourceTextId = "63c9638ce99d9f4d9010c598";

test("короткая подпись и подпись ровно по лимиту не меняются", () => {
    for (const text of ["<b>Короткий текст</b>", "я".repeat(1024), "&amp;".repeat(1024)]) {
        assert.equal(photoCaption({text}), text);
    }
});

test("длинная подпись обрезается по словам с закрытием вложенных тегов и рабочей ссылкой", () => {
    const text = '<b>Начало <i>' + "одно два три &amp; ".repeat(150) + '</i></b>';
    const caption = photoCaption({text, sourceTextId});
    assert.ok(visibleLength(caption) <= 1024);
    assert.match(caption, /<\/i><\/b>…\n\n<a href=/);
    assert.match(caption, new RegExp(`/reading/${sourceTextId}`));
    assert.match(caption, /Читать полностью на сайте<\/a>$/);
});

test("ссылка на исходник сохраняется, даже если стояла в отрезанном конце поста", () => {
    const caption = photoCaption({text: "слово ".repeat(400) + '<a href="https://www.typikon.info/reading/full-text">Весь текст</a>'});
    assert.match(caption, /href="https:\/\/www.typikon.info\/reading\/full-text"/);
    assert.ok(visibleLength(caption) <= 1024);
});

test("чужая ссылка или ссылка на календарь не выдаётся за полную версию", () => {
    for (const url of ["https://example.com/reading/full-text", "https://www.typikon.info/calendar/november-11"]) {
        assert.throws(() => photoCaption({text: "слово ".repeat(400) + `<a href="${url}">Ссылка</a>`}), /добавьте ссылку/);
    }
});

test("сущности и длинное неразрывное слово не превышают лимит", () => {
    for (const text of ["я".repeat(2000), "&#1234; ".repeat(1000), "😀 &amp; ".repeat(500)]) {
        const caption = photoCaption({text, sourceTextId});
        assert.ok(visibleLength(caption) <= 1024);
        assert.match(caption, /Читать полностью на сайте/);
    }
});

test("разметка Telegram и кавычки внутри атрибута сохраняются при сокращении", () => {
    const caption = photoCaption({sourceTextId, text: '<tg-spoiler><a href="https://example.com/?a=>">' + "слово ".repeat(500) + '</a></tg-spoiler>'});
    assert.match(caption, /<\/a><\/tg-spoiler>…/);
    assert.ok(visibleLength(caption) <= 1024);
});

test("числовые сущности учитываются как разобранный текст без повторного декодирования", () => {
    assert.equal(visibleLength("&#1234;&#x1F600;&quot;&amp;lt;"), 8);
    assert.equal(photoCaption({text: "&#1234;".repeat(1024)}), "&#1234;".repeat(1024));
});
