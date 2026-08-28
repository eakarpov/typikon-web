import test from "node:test";
import assert from "node:assert/strict";
import {
    accentedVowel,
    accentKey,
    findAccentIssues,
    hasAccent,
    isAbbreviated,
    stripAccents,
    syllables,
    WORD_PATTERN,
} from "@/lib/accents/core";

// Проверка держится на одном различении: знак ударения относится к БУКВЕ, а не к
// соседнему символу, и между ними законно стоит другая надстрочная разметка.
// Всё, что ниже, — случаи, на которых наивная проверка ошибается.

const kinds = (word: string) => findAccentIssues(word).map((issue) => issue.kind);

test("верно поставленное ударение замечаний не вызывает", () => {
    assert.deepEqual(kinds("глаго́лет"), []);
    assert.deepEqual(kinds("зело́"), []);
    // Вария и камора — такие же ударения, как оксия.
    assert.deepEqual(kinds("сотворѝ"), []);
    assert.deepEqual(kinds("сїѧ̑"), []);
});

test("псили между гласной и ударением — не ошибка", () => {
    // а + U+0486 (звательце) + U+0301: в церковнославянском наборе это норма,
    // и проверка по непосредственно предыдущему символу тут ошибается.
    assert.deepEqual(kinds("а҆́ще"), []);
    assert.deepEqual(kinds("и҆̀"), []);
});

test("разложенные ї и й ударению не мешают", () => {
    // Лествица и Маргарит хранят ї как і + U+0308, й как и + U+0306.
    assert.deepEqual(kinds("сїна́йскїѧ"), []);
    assert.deepEqual(kinds("й́"), []);
});

test("знак на согласной опознаётся", () => {
    // г + U+0301: именно так «глаѓолет» и лежит в корпусе — знак съехал с гласной.
    assert.deepEqual(kinds("глаг\u0301олет"), ["on-consonant"]);
    assert.deepEqual(kinds("нем́уже"), ["on-consonant"]);
    // ќ (U+045C) — македонская буква: та же ошибка, только вросшая в один символ.
    assert.deepEqual(kinds("яќо"), ["on-consonant"]);
    assert.equal(accentKey("яќо"), "яко");
});

test("сдвоенный знак и знак в начале слова опознаются", () => {
    assert.deepEqual(kinds("ра́́ди"), ["doubled"]);
    assert.deepEqual(kinds("́аще"), ["at-start"]);
});

test("больше двух знаков — отдельный случай, чинить вслепую нечего", () => {
    assert.ok(kinds("а\u0301е\u0301и\u0301").includes("crowded"));
});

test("слово под титлом — сокращение, ударение к нему неприменимо", () => {
    assert.ok(isAbbreviated("бж҃їѧ"));
    assert.ok(isAbbreviated("і҆и҃са"));
    assert.ok(!isAbbreviated("глаго́лет"));
});

test("ключ словаря снимает всю надстрочную разметку", () => {
    assert.equal(accentKey("Глаго́лет"), "глаголет");
    assert.equal(accentKey("а҆́ще"), "аще");
    // Ерок заменяет ъ и в ключ не идёт — иначе «под̾кра́сити» и «подкра́сити»
    // оказались бы разными словами.
    assert.equal(accentKey("под̾кра́сити"), "подкрасити");
});

test("снятие ударений не трогает прочие знаки", () => {
    assert.equal(stripAccents("а҆́ще"), "а҆ще");
    assert.equal(stripAccents("бж҃їѧ"), "бж҃їѧ");
});

test("слоги считаются по гласным, ѯ и ѱ гласными не считаются", () => {
    assert.equal(syllables("зело́"), 2);
    assert.equal(syllables("въ"), 0);
    assert.equal(syllables("ѱало́мъ"), 2);
});

test("гласные старой графики — гласные", () => {
    // ᲂ, ᲇ и ᲈ (Cyrillic Extended-C) — это о, ѣ и ꙋ; в Маргарите ударение стоит
    // прямо на них, и принимать это за ошибку нельзя.
    assert.deepEqual(kinds("єгᲂ\u0301"), []);
    assert.equal(syllables("єгᲂ"), 2);
    // А ᲅ и ᲃ того же блока — согласные, знак на них по-прежнему ошибка.
    assert.deepEqual(kinds("сᲅ\u0301ᲂ"), ["on-consonant"]);
});

test("слово не рвётся на буквах старой графики", () => {
    // О, ᲅ и прочие из Cyrillic Extended-C стоят в Маргарите и Ифике.
    assert.deepEqual("сᲅᲂꙗ̆ᲅъ".match(WORD_PATTERN), ["сᲅᲂꙗ̆ᲅъ"]);
    // Ерок внутри слова не делит его надвое.
    assert.deepEqual("и҆з̾ ни́хъ".match(WORD_PATTERN), ["и҆з̾", "ни́хъ"]);
});

test("hasAccent видит все три знака и не путает их с титлом", () => {
    assert.ok(hasAccent("зело́"));
    assert.ok(hasAccent("сотвори\u0300"));
    assert.ok(hasAccent("сїѧ̑"));
    assert.ok(!hasAccent("бж҃їѧ"));
});

test("вросшее ударение считается ударением", () => {
    // ѝ (U+045D) — это и с варией одним символом; в Библии так набраны
    // тысячи стихов, и без этого они мимо словаря.
    assert.ok(hasAccent("сотворѝ"));
    assert.deepEqual(kinds("сотворѝ"), []);
    // Ключ у обоих написаний один — иначе это два разных слова.
    assert.equal(accentKey("сотворѝ"), accentKey("сотвори\u0300"));
    assert.equal(accentKey("сотворѝ"), "сотвори");
    // Краткая и двоеточие к ударению отношения не имеют.
    assert.ok(!hasAccent("паки"));
    assert.ok(!hasAccent("мой"));
    assert.ok(!hasAccent("сїѧ"));
});

test("ударная гласная находится и во вросшем написании", () => {
    assert.deepEqual(accentedVowel("глаго́лет"), { index: 1, mark: "\u0301" });
    assert.deepEqual(accentedVowel("сотворѝ"), { index: 2, mark: "\u0300" });
});
