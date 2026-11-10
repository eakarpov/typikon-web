import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FootnoteScope, { FootnoteList } from "./FootnoteScope";
import TextMarkup from "./TextMarkup";

test("reader uses consecutive visible numbers with stable IDs, shared links and sorted endnotes", () => {
    const footnotes = ["Первая сохранённая", "", "Встречается раньше"];
    const content = "А{3} Б{1} В{3}";
    const html = renderToStaticMarkup(React.createElement(FootnoteScope, { content, footnotes }, [
        React.createElement(TextMarkup, { text: content, footnotes, key: "text" }),
        React.createElement(FootnoteList, { footnotes, key: "notes" }),
    ]));
    assert.match(html, /href="#footnotes-3"[^>]*>\[1\]/);
    assert.match(html, /href="#footnotes-1"[^>]*>\[2\]/);
    assert.ok(html.indexOf('id="footnotes-3"') < html.indexOf('id="footnotes-1"'));
    assert.doesNotMatch(html, /id="footnotes-2"/);
    assert.match(html, /1 Встречается раньше/);
    assert.match(html, /2 Первая сохранённая/);
});

test("nullable poems and footnotes from API previews do not break reading or empty text cards", () => {
    assert.equal(renderToStaticMarkup(React.createElement(FootnoteScope,
        { content: null, poems: null, footnotes: null }, React.createElement(FootnoteList, { footnotes: null }))), "");
    const notes = ["", "Пояснение"];
    const html = renderToStaticMarkup(React.createElement(FootnoteScope, { content: "Текст{2}", poems: null, footnotes: notes },
        React.createElement(TextMarkup, { text: "Текст{2}", footnotes: notes })));
    assert.match(html, /href="#footnotes-2"[^>]*>\[1\]/);
});
