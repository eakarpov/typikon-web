import test from "node:test";
import assert from "node:assert/strict";
import {
    bookPresentation, filterLibraryBooks, libraryBookHref, libraryHref, paginateLibraryBooks, readLibraryQuery,
    type LibraryBook,
} from "./libraryBooks";

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

test("поиск по названию учитывает метки, регистр, ударения и ё", () => {
    const catalogue: LibraryBook[] = [
        { id: "church", name: "Житие Фёдора́", language: "cu", category: "hagiographic" },
        { id: "civil", name: "Житие Фёдора", language: "cu_gr", category: "hagiographic" },
        { id: "russian", name: "Житие Фёдора", language: "ru", category: "hagiographic" },
        { id: "author", name: "Другая книга", author: "Фёдор", language: "cu", category: "hagiographic" },
    ];
    assert.deepEqual(filterLibraryBooks(catalogue, { q: "  ФЕДОРА ", lang: "cu", category: "hagiographic" }).map(b => b.id),
        ["church", "civil"]);
    assert.deepEqual(filterLibraryBooks(catalogue, { q: "житие   федора", script: "church" }).map(b => b.id), ["church"]);
});

test("пагинация применяется после поиска и сортировки, номер ограничен последней страницей", () => {
    const catalogue: LibraryBook[] = Array.from({ length: 34 }, (_, index) => ({
        id: String(index + 1), name: `Книга ${index + 1}`, category: index < 32 ? "liturgical" : "historical",
    })).reverse();
    const query = readLibraryQuery({ category: "liturgical", q: "Книга", sort: "name" });
    const first = paginateLibraryBooks(catalogue, query);
    assert.equal(first.books.length, 30);
    assert.deepEqual(first.books.map(book => book.id), Array.from({ length: 30 }, (_, i) => String(i + 1)));
    const last = paginateLibraryBooks(catalogue, { ...query, page: 999 });
    assert.deepEqual([last.page, last.pages, last.offset, last.total], [2, 2, 30, 32]);
    assert.deepEqual(last.books.map(book => book.id), ["31", "32"]);
    assert.equal(paginateLibraryBooks(catalogue, { ...query, sort: "name-desc" }).books[0].id, "32");
    assert.equal(paginateLibraryBooks(catalogue, { ...query, q: "Нет совпадений", page: 2 }).page, 1);
});

test("у книг без даты обновления сохраняется порядок по названию в конце списка", () => {
    const catalogue: LibraryBook[] = [
        { id: "b", name: "Часослов", updatedAt: "2026-11-01T00:00:00Z" },
        { id: "x", name: "Апостол" },
        { id: "a", name: "Библия", updatedAt: "2026-11-01T00:00:00Z" },
        { id: "c", name: "Октоих", updatedAt: "2026-11-23T00:00:00Z" },
        { id: "y", name: "Минея", updatedAt: "неверная дата" },
    ];
    const order = (sort: string) => paginateLibraryBooks(catalogue, readLibraryQuery({ sort })).books.map(book => book.id);
    assert.deepEqual(order("updated"), ["c", "a", "b", "x", "y"]);
    assert.deepEqual(order("updated-asc"), ["a", "b", "c", "x", "y"]);
});

test("ссылки между страницами сохраняют поиск, метки, редакцию и сортировку", () => {
    const query = readLibraryQuery({ q: "Минея", lang: "cu", script: "church", category: "liturgical", work: "menaion", sort: "updated", page: "2" });
    const url = new URL(libraryHref(query), "https://example.test");
    assert.deepEqual(readLibraryQuery(Object.fromEntries(url.searchParams)), query);
    assert.equal(readLibraryQuery({ sort: "constructor", page: "-3" }).sort, "name");
    assert.equal(readLibraryQuery({ page: "1e5" }).page, 1);
});
