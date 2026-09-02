import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ABSENT_VERSES, absentInBook, absentInChapter } from "./absent";
import { canonBook } from "@/utils/bibleCanon";

// Таблица правится руками и показывается читателю как текст Писания. Проверяется
// не поведение, а то, что каждая запись полна и указывает на существующее место.

describe("пропуски изданий", () => {
    it("знает про Мк. 7:16 в греческом", () => {
        const found = absentInChapter("grc-lxx-pat", "marka", 7);
        assert.equal(found.length, 1);
        assert.equal(found[0].verse, 16);
        assert.match(found[0].content, /ἀκουέτω/);
    });

    it("молчит про издания и главы, где пропусков нет", () => {
        assert.deepEqual(absentInChapter("cs-eliz", "marka", 7), []);
        assert.deepEqual(absentInChapter("grc-lxx-pat", "marka", 8), []);
        assert.deepEqual(absentInChapter(null, "marka", 7), []);
        assert.deepEqual(absentInChapter(undefined, "marka", 7), []);
    });

    it("отдаёт пропуски книги целиком", () => {
        assert.equal(absentInBook("grc-lxx-pat", "marka").length, 1);
        assert.deepEqual(absentInBook("grc-lxx-pat", "luki"), []);
    });

    it("каждая запись говорит и откуда текст, и почему его нет", () => {
        ABSENT_VERSES.forEach((item) => {
            const where = `${item.edition} ${item.canonId} ${item.chapter}:${item.verse}`;
            assert.ok(item.content.trim(), `${where}: нечего показать`);
            assert.ok(item.supplied.trim(), `${where}: не сказано, откуда текст`);
            assert.ok(item.why.trim(), `${where}: не сказано, почему стиха нет`);
            assert.ok(canonBook(item.canonId), `${where}: такой книги нет в каноне`);
            assert.ok(item.chapter > 0 && item.verse > 0, `${where}: неверный адрес`);
        });
    });

    it("не заводит две записи на один адрес", () => {
        const keys = ABSENT_VERSES.map((i) => `${i.edition} ${i.canonId} ${i.chapter}:${i.verse}`);
        assert.equal(new Set(keys).size, keys.length);
    });
});
