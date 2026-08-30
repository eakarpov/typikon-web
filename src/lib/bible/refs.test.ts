import { test } from "node:test";
import assert from "node:assert/strict";
import {
    canonSort,
    expectedVerseCount,
    formatCanonRef,
    parseCanonRef,
    parseKnownCanonRef,
    rangesToCanonSortFilter,
} from "@/lib/bible/refs";
import { parseVerseRanges, verseOrder } from "@/utils/verses";

// Через эти функции проходит каждое зачало: диапазон из базы превращается здесь в
// границы запроса. Сдвиг на единицу тут — это потерянный первый или последний стих
// чтения на службе.

test("canonSort совпадает с порядком стихов в @/utils/verses", () => {
    assert.equal(canonSort(3, 24), verseOrder(3, 24));
    assert.equal(canonSort(1, 1), verseOrder(1, 1));
});

test("canonSort возрастает по главам и стихам", () => {
    assert.ok(canonSort(1, 1) < canonSort(1, 2));
    assert.ok(canonSort(1, 999) < canonSort(2, 1));
    assert.ok(canonSort(9, 39) < canonSort(10, 1));
});

test("ссылка на стих собирается и разбирается обратно", () => {
    const ref = formatCanonRef("daniila", 3, 24);
    assert.equal(ref, "daniila.3.24");
    assert.deepEqual(parseCanonRef(ref), { canonId: "daniila", chapter: 3, verse: 24 });
});

test("разбирается ссылка на книгу с цифрой и дефисом в идентификаторе", () => {
    assert.deepEqual(parseCanonRef("1-korinfyanam.13.1"), {
        canonId: "1-korinfyanam",
        chapter: 13,
        verse: 1,
    });
});

test("негодная ссылка даёт null, а не полуразобранный объект", () => {
    assert.equal(parseCanonRef(""), null);
    assert.equal(parseCanonRef(null), null);
    assert.equal(parseCanonRef("daniila.3"), null);
    assert.equal(parseCanonRef("daniila.три.24"), null);
    assert.equal(parseCanonRef("daniila.0.1"), null);
    assert.equal(parseCanonRef("daniila.3.0"), null);
});

// Книга вне канона в ссылке — это не опечатка читателя, а разъехавшиеся данные:
// либо издание размечено чужим идентификатором, либо канон поехал.
test("ссылка на книгу вне канона отсекается проверкой", () => {
    assert.equal(parseKnownCanonRef("daniila.3.24")?.canonId, "daniila");
    assert.equal(parseKnownCanonRef("susanny.1.1"), null);
});

test("диапазон превращается в границы canonSort включительно", () => {
    const filter = rangesToCanonSortFilter(parseVerseRanges("3:1-3:88"));
    assert.deepEqual(filter, {
        $or: [{ canonSort: { $gte: canonSort(3, 1), $lte: canonSort(3, 88) } }],
    });
});

test("несколько диапазонов дают несколько условий", () => {
    const filter = rangesToCanonSortFilter(parseVerseRanges("2:31-2:36, 2:44-2:45"));
    assert.equal(filter?.$or.length, 2);
    assert.equal(filter?.$or[1].canonSort.$gte, canonSort(2, 44));
    assert.equal(filter?.$or[1].canonSort.$lte, canonSort(2, 45));
});

// Пустой $or — ошибка Mongo, а не «выбрать всё». Пустые диапазоны означают всю
// книгу, поэтому фильтра быть не должно вовсе.
test("пустые диапазоны не дают фильтра", () => {
    assert.equal(rangesToCanonSortFilter([]), null);
    assert.equal(rangesToCanonSortFilter(null), null);
});

// Дан 3:1–88 — та самая паремия, на которой ломался румынский резолв: книга есть,
// а половины диапазона нет. Ожидаемое число считается по эталону.
test("ожидаемое число стихов считается по длинам глав эталона", () => {
    const daniel = [21, 49, 100, 37];
    assert.equal(expectedVerseCount(parseVerseRanges("3:1-3:88"), daniel), 88);
    assert.equal(expectedVerseCount(parseVerseRanges("1:1-1:21"), daniel), 21);
});

test("диапазон через границу главы считается по обеим главам", () => {
    const book = [10, 10, 10];
    assert.equal(expectedVerseCount(parseVerseRanges("1:8-2:3"), book), 6);
});

test("диапазон за пределами главы не досчитывает несуществующих стихов", () => {
    const book = [10];
    assert.equal(expectedVerseCount(parseVerseRanges("1:1-1:99"), book), 10);
});

test("пересекающиеся диапазоны не удваивают счёт", () => {
    const book = [10];
    assert.equal(expectedVerseCount(parseVerseRanges("1:1-1:5, 1:4-1:7"), book), 7);
});

test("без диапазонов ожидается вся книга", () => {
    assert.equal(expectedVerseCount([], [21, 49, 100]), 170);
});

test("без эталона ожидаемое неизвестно, а не равно нулю", () => {
    assert.equal(expectedVerseCount(parseVerseRanges("3:1-3:88"), null), null);
    assert.equal(expectedVerseCount(parseVerseRanges("3:1-3:88"), []), null);
});
