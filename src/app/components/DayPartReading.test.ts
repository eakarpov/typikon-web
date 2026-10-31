import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DayPartReading from "./DayPartReading";
import ReadingAssignmentHeader from "./ReadingAssignmentHeader";
import { readingParts, readingStatia } from "@/lib/readingParts";
import { TextType } from "@/utils/texts";

const text = { _id: "012345678901234567890123", alias: "slovo-na-prazdnik", name: "Поучение на праздник",
    book: { name: "Евангелие учительное" }, bookIndex: 21, content: "Первая часть[Среда:]Вторая часть" };
const render = (items: any[]) => renderToStaticMarkup(React.createElement(DayPartReading, {
    valueName: TextType.KATHISMA_1, value: { items },
}));
const bodies = (html: string) => [...html.matchAll(/<p class="[^"]*text-justify text-lg[^"]*">([\s\S]*?)<\/p>/g)].map(m => m[1]);

test("название, книга и выбранная статия видны без наведения; полный текст имеет именованную ссылку", () => {
    const html = render([{ text, statia: 2, cite: "Чтение праздника надвое." }]);
    assert.match(html, /<h3[^>]*>Поучение на праздник<\/h3>/);
    assert.match(html, /Евангелие учительное/);
    assert.match(html, /Статия 2 из 2/);
    assert.match(html, /href="\/reading\/slovo-na-prazdnik"/);
    assert.match(html, /aria-label="Открыть полный текст: Поучение на праздник"/);
    assert.match(html, /<details[^>]*><summary/);
    assert.doesNotMatch(html, /<details[^>]*\bopen(?:=|\s|>)/);
    assert.match(html, /Типикон:<\/strong> Чтение праздника надвое\./);
    assert.deepEqual(bodies(html), ["Вторая часть"]);
});

test("две статии одного произведения сохраняют порядок и независимые пояснения", () => {
    const html = render([{ text, statia: 1, cite: "Первое назначение." }, { text, statia: 2, cite: "Второе назначение." }]);
    assert.deepEqual(bodies(html), ["Первая часть", "Вторая часть"]);
    assert.equal([...html.matchAll(/<details\b/g)].length, 2);
    assert.match(html, /Статия 1 из 2/);
    assert.match(html, /Статия 2 из 2/);
});

test("без цитаты нет пустого раскрытия; уставная помета видна сразу", () => {
    const html = render([{ text, description: "Аще Кириопасха", cite: " " }]);
    assert.doesNotMatch(html, /<details/);
    assert.match(html, /Аще Кириопасха/);
    assert.deepEqual(bodies(html), ["Первая часть"]);
    assert.match(html, /Статия 1 из 2/);
});

test("без алиаса сохраняется ссылка по ID, без названия используется книга", () => {
    const html = renderToStaticMarkup(React.createElement(ReadingAssignmentHeader, {
        text: { _id: text._id, book: text.book, content: "Текст без деления" },
    }));
    assert.match(html, new RegExp(`href="/reading/${text._id}"`));
    assert.match(html, /Чтение из книги/);
    assert.doesNotMatch(html, /Статия|undefined|null/);
});

test("существующие маркеры и отсутствие тела обрабатываются без смены границ", () => {
    assert.deepEqual(readingParts("Один[Статия 2]Два[Статия 3]Три"), ["Один", "Два", "Три"]);
    assert.deepEqual(readingParts(undefined), [""]);
    assert.equal(readingStatia("Целый текст"), null);
    assert.equal(readingStatia("Целый текст", 1), "Статия 1");
    assert.equal(readingStatia(text.content, -1), null);
});

test("ссылка на библейское чтение имеет доступное имя и пояснение назначения", () => {
    const html = render([{ cite: "Евангелие праздника.", pericope: { id: "gospel", label: "Ин. 65Б", bookSlug: "ioanna", ranges: [{ chapterFrom: 20 }], verses: [] } }]);
    assert.match(html, /aria-label="Открыть Ин\. 65Б в Библии"/);
    assert.match(html, /href="\/bible\/ioanna\/20"/);
    assert.match(html, /Евангелие праздника\./);
});
