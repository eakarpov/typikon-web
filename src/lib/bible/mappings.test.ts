import { test } from "node:test";
import assert from "node:assert/strict";
import { BIBLE_MAPPINGS, mappingsFor, toCanonRef } from "@/lib/bible/mappings";
import { isCanonBook } from "@/utils/bibleCanon";

const ro = mappingsFor("ro-1688");

// Правила — единственное место, где родная нумерация издания встречается с
// канонической. Ошибка здесь сдвигает не показ, а само содержание чтения:
// паремия начнётся не с того стиха и оборвётся не на том.

test("правила заведены только для румынского издания", () => {
    assert.ok(ro.length > 0);
    assert.equal(mappingsFor("cs-eliz").length, 0, "церковнославянское издание — эталон, правил у него нет");
});

test("правила ведут в книги, которые есть в каноне", () => {
    BIBLE_MAPPINGS.forEach((rule) => {
        const target = rule.to.book ?? rule.from.book;
        assert.ok(isCanonBook(target), `правило ведёт в неизвестную книгу ${target}`);
    });
});

// Дан. 3 — та самая паремия, из-за которой всё затевалось. Славянская глава в
// 100 стихов = 23 стиха повествования + 67 стихов песни + 10 стихов продолжения;
// румынское издание держит повествование в своей главе, а песнь — отдельной книгой.
test("песнь трёх отроков ложится в Дан. 3:24–90", () => {
    assert.deepEqual(toCanonRef(ro, "pesn-trekh-otrokov", 1, 1), {
        canonId: "daniila", chapter: 3, verse: 24,
    });
    assert.deepEqual(toCanonRef(ro, "pesn-trekh-otrokov", 1, 67), {
        canonId: "daniila", chapter: 3, verse: 90,
    });
});

test("повествование Дан. 3 до песни остаётся на месте", () => {
    assert.deepEqual(toCanonRef(ro, "daniila", 3, 1), {
        canonId: "daniila", chapter: 3, verse: 1,
    });
    assert.deepEqual(toCanonRef(ro, "daniila", 3, 23), {
        canonId: "daniila", chapter: 3, verse: 23,
    });
});

test("продолжение Дан. 3 после песни сдвигается на её длину", () => {
    assert.deepEqual(toCanonRef(ro, "daniila", 3, 24), {
        canonId: "daniila", chapter: 3, verse: 91,
    });
    assert.deepEqual(toCanonRef(ro, "daniila", 3, 33), {
        canonId: "daniila", chapter: 3, verse: 100,
    });
});

// Три куска румынской главы обязаны покрыть славянскую сотню без дыр и нахлёстов —
// это и есть проверка, что сдвиги подобраны верно, а не «примерно похоже».
test("Дан. 3 собирается из трёх кусков в сплошные 100 стихов", () => {
    const covered = new Set<number>();
    for (let verse = 1; verse <= 33; verse++) covered.add(toCanonRef(ro, "daniila", 3, verse).verse);
    for (let verse = 1; verse <= 67; verse++) {
        covered.add(toCanonRef(ro, "pesn-trekh-otrokov", 1, verse).verse);
    }

    assert.equal(covered.size, 100, "куски перекрылись или оставили дыру");
    assert.equal(Math.min(...covered), 1);
    assert.equal(Math.max(...covered), 100);
});

test("Сусанна ложится в Дан. 13 стих в стих", () => {
    assert.deepEqual(toCanonRef(ro, "susanny", 1, 1), { canonId: "daniila", chapter: 13, verse: 1 });
    assert.deepEqual(toCanonRef(ro, "susanny", 1, 64), { canonId: "daniila", chapter: 13, verse: 64 });
});

test("Вил ложится в Дан. 14 — правило помечено как неточное", () => {
    assert.deepEqual(toCanonRef(ro, "vil-i-drakon", 1, 1), { canonId: "daniila", chapter: 14, verse: 1 });
    const rule = ro.find((r) => r.from.book === "vil-i-drakon");
    assert.equal(rule?.exact, false, "разбивка Вила расходится — правило не должно выглядеть точным");
});

// Малахия и Иоиль разбиты по еврейскому счёту. Без правил паремия «Мал. 4:4–6»
// отдавала на румынском ноль стихов, а «Иоил. 2:23–32» — половину.
test("хвост румынской Мал. 3 ложится в славянскую Мал. 4", () => {
    assert.deepEqual(toCanonRef(ro, "malakhii", 3, 19), {
        canonId: "malakhii", chapter: 4, verse: 1,
    });
    assert.deepEqual(toCanonRef(ro, "malakhii", 3, 24), {
        canonId: "malakhii", chapter: 4, verse: 6,
    });
    // Граница правила: восемнадцатый стих остаётся третьей главой.
    assert.deepEqual(toCanonRef(ro, "malakhii", 3, 18), {
        canonId: "malakhii", chapter: 3, verse: 18,
    });
});

test("Малахия собирается в сплошные 55 стихов", () => {
    const refs = new Set<string>();
    ([[1, 14], [2, 17], [3, 24]] as const).forEach(([chapter, length]) => {
        for (let verse = 1; verse <= length; verse++) {
            const ref = toCanonRef(ro, "malakhii", chapter, verse);
            refs.add(`${ref.chapter}:${ref.verse}`);
        }
    });
    assert.equal(refs.size, 55, "куски перекрылись или оставили дыру");
});

test("Иоиль пересчитывается с еврейского счёта на греческий", () => {
    assert.deepEqual(toCanonRef(ro, "ioilya", 3, 1), { canonId: "ioilya", chapter: 2, verse: 28 });
    assert.deepEqual(toCanonRef(ro, "ioilya", 3, 5), { canonId: "ioilya", chapter: 2, verse: 32 });
    assert.deepEqual(toCanonRef(ro, "ioilya", 4, 1), { canonId: "ioilya", chapter: 3, verse: 1 });
    assert.deepEqual(toCanonRef(ro, "ioilya", 4, 21), { canonId: "ioilya", chapter: 3, verse: 21 });
    assert.deepEqual(toCanonRef(ro, "ioilya", 2, 27), { canonId: "ioilya", chapter: 2, verse: 27 });
});

test("Иоиль собирается в сплошные 73 стиха", () => {
    const refs = new Set<string>();
    ([[1, 20], [2, 27], [3, 5], [4, 21]] as const).forEach(([chapter, length]) => {
        for (let verse = 1; verse <= length; verse++) {
            const ref = toCanonRef(ro, "ioilya", chapter, verse);
            refs.add(`${ref.chapter}:${ref.verse}`);
        }
    });
    assert.equal(refs.size, 73, "куски перекрылись или оставили дыру");
});

// Правил мало, а книг много: подавляющее большинство стихов проходит насквозь,
// и это поведение по умолчанию должно быть именно таким, а не пустым результатом.
test("книга без правила остаётся в своей нумерации", () => {
    assert.deepEqual(toCanonRef(ro, "bytie", 1, 1), { canonId: "bytie", chapter: 1, verse: 1 });
    assert.deepEqual(toCanonRef(ro, "psaltir", 118, 176), {
        canonId: "psaltir", chapter: 118, verse: 176,
    });
    assert.deepEqual(toCanonRef(ro, "daniila", 12, 13), {
        canonId: "daniila", chapter: 12, verse: 13,
    });
});

test("без правил вовсе ссылка не меняется", () => {
    assert.deepEqual(toCanonRef([], "susanny", 1, 1), { canonId: "susanny", chapter: 1, verse: 1 });
});
