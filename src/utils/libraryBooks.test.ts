import test from "node:test";
import assert from "node:assert/strict";
import { bookPresentation, filterLibraryBooks, libraryBookHref, type LibraryBook } from "./libraryBooks";

const books: LibraryBook[] = [
    { id: "1", name: "Пролог", language: "cu_gr", workKey: "prolog", alias: "prolog-civil" },
    { id: "2", name: "Пролог", language: "cu", workKey: "prolog" },
    { id: "3", name: "Маргарит", language: "cu", workKey: "margarit" },
    { id: "4", name: "Чувашская Библия", language: "cv_cu", bibleCode: "cv-church" },
    { id: "5", name: "Перевод", language: "ru" },
];

test("язык объединяет начертания, а гражданский / церковный фильтруются отдельно", () => {
    assert.deepEqual(filterLibraryBooks(books, { lang: "cu" }).map(b => b.id), ["1", "2", "3"]);
    assert.deepEqual(filterLibraryBooks(books, { lang: "cu", script: "church" }).map(b => b.id), ["2", "3"]);
    assert.deepEqual(filterLibraryBooks(books, { script: "church" }).map(b => b.id), ["2", "3", "4"]);
    assert.equal(filterLibraryBooks(books, { lang: "ru", script: "church" }).length, 0);
});

test("редакции связываются явным ключом произведения и остаются доступны для отбора", () => {
    assert.deepEqual(filterLibraryBooks(books, { work: "prolog" }).map(b => b.id), ["1", "2"]);
    assert.deepEqual(filterLibraryBooks(books, { work: "prolog", script: "civil" }).map(b => b.id), ["1"]);
    assert.equal(filterLibraryBooks([...books, { id: "6", name: "Пролог" }], { work: "prolog" }).length, 2);
});

test("неизвестный язык не получает чужую маркировку; старый пустой использует общий default", () => {
    assert.equal(bookPresentation("xx").label, "xx");
    assert.equal(bookPresentation("xx").script, "unknown");
    assert.deepEqual(bookPresentation(undefined), bookPresentation("cu_gr"));
    assert.equal(bookPresentation("ro_cyr").lang, bookPresentation("ro").lang);
    assert.notEqual(bookPresentation("ro_cyr").script, bookPresentation("ro").script);
});

test("фильтрация не меняет адреса книг и переход в издание Библии", () => {
    assert.equal(libraryBookHref(books[0]), "/library/prolog-civil");
    assert.equal(libraryBookHref(books[1]), "/library/2");
    assert.equal(libraryBookHref(books[3]), "/bible?v=cv-church");
});

test("тематика сочетается с языком и начертанием, а отсутствие темы остаётся видимым", () => {
    const themed: LibraryBook[] = [
        { id: "a", name: "Маргарит", language: "cu", category: "patristic" },
        { id: "b", name: "Пролог", language: "cu", category: "hagiographic" },
        { id: "c", name: "Пролог", language: "cu_gr", category: "hagiographic" },
        { id: "d", name: "Новая книга" },
    ];
    assert.deepEqual(filterLibraryBooks(themed, { category: "hagiographic", lang: "cu", script: "church" }).map(b => b.id), ["b"]);
    assert.deepEqual(filterLibraryBooks(themed, { category: "uncategorized" }).map(b => b.id), ["d"]);
    assert.equal(filterLibraryBooks(themed, { category: "bible" }).length, 0);
});

test("русский в церковном начертании не смешивается с церковнославянским языком", () => {
    const info = bookPresentation("ru_cu");
    assert.equal(info.lang, "ru");
    assert.equal(info.script, "church");
    assert.equal(bookPresentation("orv").label, "Древнерусский");
    assert.equal(bookPresentation("orv").script, "civil");
});
