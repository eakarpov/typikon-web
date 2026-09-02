import test from "node:test";
import assert from "node:assert/strict";
import { layoutCitations, canonSortRange, verseHref, type Citation } from "./citations";

const at = (start: number, end: number, ref: string, words = 6,
            confidence: Citation["confidence"] = "certain"): Citation => {
    const [canonId, chapter, verse] = ref.split(".");
    return {
        canonRef: ref, canonId, chapter: Number(chapter), verse: Number(verse),
        canonSort: Number(chapter) * 100000 + Number(verse),
        start, end, words, confidence, method: "ngram",
    };
};

const joined = (text: string, citations: Citation[]) =>
    layoutCitations(text, citations).map(p => (p.break ? "/" : p.text)).join("");

test("текст без цитат остаётся целым, размечены только разрывы строк", () => {
    const text = "Ка́мень, его́же небрего́ша/ зи́ждущии";
    const parts = layoutCitations(text, []);
    assert.equal(parts.length, 3);
    assert.deepEqual(parts.map(p => p.break === true), [false, true, false]);
    assert.ok(parts.every(p => p.refs.length === 0));
});

test("куски складываются обратно в исходный текст", () => {
    // Инвариант ловит разом потерю пробела, сдвиг на символ и задвоение —
    // ради него в раскладке нет ни одного .trim().
    const text = "Ка́мень, его́же небрего́ша/ зи́ждущии, се́й бы́сть во главу́ у́гла";
    assert.equal(joined(text, []), text);
    assert.equal(joined(text, [at(0, 26, "psaltir.117.22")]), text);
    assert.equal(joined(text, [at(9, 40, "psaltir.117.22")]), text);
    assert.equal(joined(text, [at(0, 26, "psaltir.117.22"), at(20, 45, "matfeya.21.42")]), text);
});

test("цитата, перечёркнутая разрывом строки, продолжается на следующей", () => {
    const text = "его́же небрего́ша/ зи́ждущии";
    const parts = layoutCitations(text, [at(0, text.length, "psaltir.117.22")]);
    assert.equal(parts.length, 3);
    assert.equal(parts[1].break, true);
    assert.equal(parts[0].refs[0].canonRef, "psaltir.117.22");
    assert.equal(parts[2].refs[0].canonRef, "psaltir.117.22");
});

test("одна фраза, отозвавшаяся в двух стихах, текста не дробит", () => {
    const text = "Ка́мень, его́же небрего́ша зи́ждущии";
    const parts = layoutCitations(text, [
        at(0, text.length, "psaltir.117.22"),
        at(0, text.length, "matfeya.21.42"),
    ]);
    assert.equal(parts.length, 1);
    assert.equal(parts[0].refs.length, 2);
});

test("перекрывающиеся цитаты дают общий кусок посередине", () => {
    const text = "0123456789abcde";
    const parts = layoutCitations(text, [
        at(0, 10, "psaltir.1.1"),
        at(5, 15, "psaltir.2.2"),
    ]);
    assert.deepEqual(parts.map(p => p.refs.length), [1, 2, 1]);
    assert.deepEqual(parts.map(p => p.text), ["01234", "56789", "abcde"]);
});

test("вложенная цитата не прячет объемлющую", () => {
    const text = "0123456789";
    const parts = layoutCitations(text, [
        at(0, 10, "psaltir.1.1", 9),
        at(3, 6, "psaltir.2.2", 4),
    ]);
    assert.deepEqual(parts.map(p => p.refs.length), [1, 2, 1]);
    // Внутри общего куска длинная цитата стоит первой.
    assert.equal(parts[1].refs[0].canonRef, "psaltir.1.1");
});

test("соседние куски с теми же стихами не дробятся", () => {
    // Две цитаты стык в стык на один и тот же стих: для читателя это одно
    // сплошное место, и шва между ними быть не должно.
    const text = "0123456789";
    const parts = layoutCitations(text, [
        at(0, 5, "psaltir.1.1"),
        at(5, 10, "psaltir.1.1"),
    ]);
    assert.equal(parts.length, 1);
    assert.equal(parts[0].text, text);
    assert.equal(parts[0].refs.length, 1);
});

test("догадка отличима от уверенного совпадения", () => {
    const text = "0123456789";
    const parts = layoutCitations(text, [at(0, 5, "psaltir.1.1", 3, "candidate")]);
    assert.equal(parts[0].certain, false);
    assert.equal(parts[1].certain, false);
    const sure = layoutCitations(text, [at(0, 5, "psaltir.1.1", 7, "certain")]);
    assert.equal(sure[0].certain, true);
});

test("испорченные границы раскладку не роняют", () => {
    const text = "Ка́мень, его́же небрего́ша";
    const broken = [
        at(5, 3, "psaltir.1.1"),          // конец раньше начала
        at(-2, 4, "psaltir.2.2"),         // начало до текста
        at(0, 9999, "psaltir.3.3"),       // конец за текстом
        at(3, 3, "psaltir.4.4"),          // нулевая длина
        at(text.length, text.length + 5, "psaltir.5.5"),  // целиком за текстом
    ];
    assert.equal(joined(text, broken), text);
    // Уцелеть должна ровно та, что подрезается по длине текста.
    const refs = new Set(layoutCitations(text, broken).flatMap(p => p.refs.map(c => c.canonRef)));
    assert.deepEqual([...refs], ["psaltir.3.3"]);
});

test("диапазон стиха и диапазон главы считаются одной формулой", () => {
    assert.deepEqual(canonSortRange(117, 22), [11700022, 11700022]);
    const [from, to] = canonSortRange(117);
    assert.ok(from < 11700022 && 11700022 < to);
});

test("адрес стиха ведёт внутрь, а не наружу", () => {
    assert.equal(verseHref({ canonId: "psaltir", chapter: 117, verse: 22 }),
                 "/bible/psaltir/117#v22");
});
