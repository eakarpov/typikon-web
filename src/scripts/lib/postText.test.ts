import {test} from "node:test";
import assert from "node:assert/strict";
import {visibleLength, truncateHtmlByWords} from "./postText";

test("разметка в длину не входит, а её текст — входит", () => {
    assert.equal(visibleLength('<a href="https://example.org/очень/длинный/адрес">Текст</a>'), 5);
    assert.equal(visibleLength("<b>Стихи́:</b>"), 7);
});

test("сущность считается за один знак", () => {
    // Telegram видит «А&Б», то есть три знака, а не восемь.
    assert.equal(visibleLength("А&amp;Б"), 3);
    assert.equal(visibleLength("&lt;b&gt;"), 3);
});

test("короткий текст не трогается", () => {
    const html = "Слово за словом";
    assert.deepEqual(truncateHtmlByWords(html, 100), { html, truncated: false });
});

test("режется по границе слова, а не посреди него", () => {
    const res = truncateHtmlByWords("один два три четыре", 11);
    // «один два» — восемь знаков; «три» уже не влезает.
    assert.equal(res.html, "один два…");
    assert.equal(res.truncated, true);
});

test("открытый тег закрывается на месте разреза", () => {
    // Незакрытый <a> Telegram не разбирает и отвечает отказом — это стоило бы
    // не хвоста, а всего поста.
    const res = truncateHtmlByWords('до <a href="https://example.org/">ссылка длинная тут</a> после', 16);
    assert.equal(res.truncated, true);
    assert.match(res.html, /<\/a>…$/);
    assert.equal((res.html.match(/<a /g) || []).length, (res.html.match(/<\/a>/g) || []).length);
});

test("длина разреза не превышает выданного предела", () => {
    const html = 'Начало <b>жирное слово</b> и <a href="https://example.org/">ссылка</a> и хвост подлиннее';
    for (const budget of [5, 10, 20, 30, 40]) {
        const res = truncateHtmlByWords(html, budget);
        assert.ok(visibleLength(res.html) <= budget + 1, `предел ${budget}: вышло ${visibleLength(res.html)}`);
    }
});

test("нулевой запас даёт пустоту, а не половину тега", () => {
    assert.deepEqual(truncateHtmlByWords("<b>что-то</b>", 0), { html: "", truncated: true });
});
