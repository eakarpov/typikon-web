import { test } from "node:test";
import assert from "node:assert/strict";
import { bibleBookList } from "@/utils/bibleBooks";
import { BIBLE_CANON, BIBLE_SECTIONS } from "@/utils/bibleCanon";
import { BIBLE_APPENDIX } from "@/utils/bibleAppendix";

// Оглавление уходит наружу ручкой /api/v2/bible/books, и по нему мобильное
// приложение строит вход в раздел: разделы, книги, сетку глав. Ошибка здесь не
// косметическая — книга без числа глав это книга, которую нельзя открыть, а
// съехавший порядок это Иона, которого не найти.

test("оглавление — весь канон и следом приложение", () => {
    const books = bibleBookList();

    assert.equal(books.length, BIBLE_CANON.length + BIBLE_APPENDIX.length);
    assert.equal(books.filter((book) => book.inCanon).length, BIBLE_CANON.length);
    assert.equal(books.filter((book) => !book.inCanon).length, BIBLE_APPENDIX.length);
});

test("канон идёт первым и в своём порядке, а не по алфавиту", () => {
    // Порядок — часть ответа: клиент, сгруппировавший книги по разделам, получает
    // порядок внутри раздела даром, и восстанавливать его ему неоткуда.
    const canon = bibleBookList().filter((book) => book.inCanon);

    assert.deepEqual(canon.map((book) => book.id), BIBLE_CANON.map((book) => book.id));
    assert.equal(canon[0].id, "bytie");
    assert.equal(canon.at(-1)?.id, "otkrovenie");
});

test("приложение стоит после канона, а не вперемешку", () => {
    const books = bibleBookList();
    const lastCanon = books.findLastIndex((book) => book.inCanon);
    const firstAppendix = books.findIndex((book) => !book.inCanon);

    assert.ok(lastCanon < firstAppendix, "книга приложения затесалась в канон");
});

test("идентификаторы уникальны на весь список", () => {
    // Канон и приложение — два списка, и общий id в них означал бы, что два разных
    // текста претендуют на одно место в параллельном виде.
    const ids = bibleBookList().map((book) => book.id);

    assert.equal(new Set(ids).size, ids.length);
});

test("у каждой книги канона есть число глав", () => {
    // Число берётся из эталонной версификации. Ноль здесь значил бы книгу, которую
    // приложение покажет в оглавлении и не даст открыть ни одной главы.
    for (const book of bibleBookList().filter((book) => book.inCanon)) {
        assert.equal(typeof book.chapters, "number", `${book.id}: глав не сосчитано`);
        assert.ok((book.chapters ?? 0) > 0, `${book.id}: ноль глав`);
    }
});

test("у книг приложения число глав null, а не ноль", () => {
    // Эталон снят с церковнославянского издания, а этих книг в нём нет вовсе.
    // Ноль сказал бы «глав нет» — неправда; null говорит «мы не считали».
    for (const book of bibleBookList().filter((book) => !book.inCanon)) {
        assert.equal(book.chapters, null, `${book.id}: у приложения проставлено число глав`);
    }
});

test("раздел книги канона — настоящий раздел, приложения — appendix", () => {
    const sections = new Set(BIBLE_SECTIONS.map((section) => section.id));

    for (const book of bibleBookList()) {
        if (book.inCanon) {
            assert.ok(sections.has(book.section as never), `${book.id}: раздел ${book.section}`);
        } else {
            assert.equal(book.section, "appendix");
        }
    }
});

test("книга вне канона объясняет, почему она вне канона", () => {
    // Без пояснения читатель получит книги, которых не найдёт ни в одном привычном
    // издании, и решит, что у нас в оглавлении мусор.
    for (const book of bibleBookList().filter((book) => !book.inCanon)) {
        assert.ok(book.note && book.note.length > 0, `${book.id}: нет пояснения`);
    }
});

test("книге канона пояснения не приписывается", () => {
    for (const book of bibleBookList().filter((book) => book.inCanon)) {
        assert.equal(book.note, undefined, `${book.id}: канонической книге приписано пояснение`);
    }
});
