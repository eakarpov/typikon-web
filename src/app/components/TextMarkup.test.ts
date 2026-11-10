import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TextMarkup from "./TextMarkup";
import Poems from "./Poems";

test("Markdown previews render emphasis together with corpus tags", () => {
    const html = renderToStaticMarkup(React.createElement(TextMarkup, { text: "**Слово** *курсив* {k|киноварь} {st|svyatoy|святой} {pl|gorod|город} {t|text|чтение} {1}", markdown: true, footnotes: ["Пояснение"] }));
    assert.match(html, /<strong>Слово<\/strong>/);
    assert.match(html, /<em>курсив<\/em>/);
    for (const href of ["/saints/svyatoy", "/places/gorod", "/reading/text", "#footnotes-1"]) assert.ok(html.includes(`href="${href}"`));
    assert.match(html, /text-red-600">киноварь/);
    assert.doesNotMatch(html, /\*\*|\{k\|/);
});
test("legacy text retains literal Markdown, poems support multiple blocks and tags", () => {
    assert.match(renderToStaticMarkup(React.createElement(TextMarkup, { text: "**Слово**" })), /\*\*Слово\*\*/);
    const html = renderToStaticMarkup(React.createElement(Poems, { value: "{k|Первый}\nВторой\n\n{pl|rim|Рим}\n\n**Третий**", markdown: true }));
    assert.equal((html.match(/class="whitespace-pre-wrap font-serif italic/g) ?? []).length, 3);
    assert.match(html, /href="\/places\/rim"/);
    assert.match(html, /<strong>Третий<\/strong>/);
});
