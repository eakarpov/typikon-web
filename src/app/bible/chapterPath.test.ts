import test from "node:test";
import assert from "node:assert/strict";
import { chapterPath } from "@/app/bible/chapterPath";

test("путь главы меняет номер главы", () => {
    assert.equal(chapterPath("/bible/pritchi/31", 1), "/bible/pritchi/1");
    assert.equal(chapterPath("/bible/1-makkaveyskaya/12", 5), "/bible/1-makkaveyskaya/5");
});

test("оглавление Библии остаётся собой: главы у него нет", () => {
    // Прежде отсюда получалось «/1» — адрес, которого нет, и счёт уводил на 404.
    assert.equal(chapterPath("/bible", 1), "/bible");
    assert.equal(chapterPath("/bible/", 1), "/bible/");
});

test("чужой путь не трогаем", () => {
    assert.equal(chapterPath("/", 1), "/");
    assert.equal(chapterPath("/bible/pritchi", 1), "/bible/pritchi");
    assert.equal(chapterPath("/chteniya/2026-08-31", 1), "/chteniya/2026-08-31");
});
