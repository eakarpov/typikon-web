import { test } from "node:test";
import assert from "node:assert/strict";
import { filterVersesByRanges, isVerseInRanges, parseVerseRanges, sortVerses } from "@/utils/verses";

// Диапазоны приходят из адреса страницы чтения (?range=3:6-3:12) — это зачало,
// которое читается на службе, поэтому ошибка здесь показывает не тот отрывок.
test("разбирается диапазон в пределах главы", () => {
    assert.deepEqual(parseVerseRanges("3:6-3:12"), [
        { chapterFrom: 3, verseFrom: 6, chapterTo: 3, verseTo: 12 },
    ]);
});

test("разбирается одиночный стих", () => {
    assert.deepEqual(parseVerseRanges("8:7"), [
        { chapterFrom: 8, verseFrom: 7, chapterTo: 8, verseTo: 7 },
    ]);
});

test("разбирается несколько диапазонов через запятую", () => {
    assert.equal(parseVerseRanges("1:1-1:5, 2:3-2:4").length, 2);
});

test("мусор отбрасывается, а не роняет страницу", () => {
    assert.deepEqual(parseVerseRanges("абв"), []);
    assert.deepEqual(parseVerseRanges(""), []);
    assert.deepEqual(parseVerseRanges(null), []);
    assert.deepEqual(parseVerseRanges(undefined), []);
    assert.equal(parseVerseRanges("1:1-1:5, мусор").length, 1, "валидная часть должна остаться");
});

test("пустой список диапазонов означает «весь текст»", () => {
    // Иначе страница чтения без ?range показывала бы пустоту.
    assert.equal(isVerseInRanges(5, 5, []), true);
});

test("границы диапазона включаются", () => {
    const ranges = parseVerseRanges("3:6-3:12");
    assert.equal(isVerseInRanges(3, 6, ranges), true, "первый стих входит");
    assert.equal(isVerseInRanges(3, 12, ranges), true, "последний стих входит");
    assert.equal(isVerseInRanges(3, 5, ranges), false);
    assert.equal(isVerseInRanges(3, 13, ranges), false);
});

test("диапазон через границу главы не обрывается", () => {
    const ranges = parseVerseRanges("3:30-4:2");
    assert.equal(isVerseInRanges(3, 31, ranges), true, "конец третьей главы");
    assert.equal(isVerseInRanges(4, 1, ranges), true, "начало четвёртой");
    assert.equal(isVerseInRanges(4, 3, ranges), false);
    assert.equal(isVerseInRanges(2, 31, ranges), false, "стих раньше начала");
});

test("фильтрация оставляет только стихи зачала", () => {
    const verses = [
        { chapter: 3, verse: 5 }, { chapter: 3, verse: 6 },
        { chapter: 3, verse: 12 }, { chapter: 3, verse: 13 },
    ];
    assert.deepEqual(
        filterVersesByRanges(verses, parseVerseRanges("3:6-3:12")),
        [{ chapter: 3, verse: 6 }, { chapter: 3, verse: 12 }],
    );
});

test("стихи сортируются по главе, затем по стиху", () => {
    const sorted = sortVerses([
        { chapter: 10, verse: 1 }, { chapter: 2, verse: 10 }, { chapter: 2, verse: 2 },
    ]);
    assert.deepEqual(sorted, [
        { chapter: 2, verse: 2 }, { chapter: 2, verse: 10 }, { chapter: 10, verse: 1 },
    ]);
});
