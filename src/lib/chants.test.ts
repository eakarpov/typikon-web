import { test } from "node:test";
import assert from "node:assert/strict";
import { matchExpression, splitSnippet, conditionsFor, HIT_OPEN, HIT_CLOSE } from "@/lib/chants";

test("запрос становится фразой с префиксом", () => {
    // Фраза, а не набор слов: так поиск ведёт себя как привычная подстрока.
    // Набором слов «спаси ны» нашлось бы 309 строк вместо 213 — совпали бы и те,
    // где слова стоят порознь и в разном порядке.
    assert.equal(matchExpression("спаси ны"), '"спаси ны"*');
});

test("ударения и ЦС-графика в запросе набирать не нужно", () => {
    assert.equal(matchExpression("Услы́ши"), '"услыши"*');
    assert.equal(matchExpression("і҆ѡа́нна"), '"иоанна"*');
    // Диграф «ук»: посимвольно сложился бы в «оу» и не сошёлся бы с «услыши».
    assert.equal(matchExpression("ᲂу҆слы́ши"), '"услыши"*');
});

test("синтаксис FTS5 из поля ввода обезврежен", () => {
    // Всё это внутри фразы — обычные символы, а не операторы. Иначе строка из
    // поля ввода роняла бы поиск ошибкой разбора выражения.
    for (const raw of ["*", "()", "AND", "NEAR", "a:b", "^", "-", "\\"]) {
        assert.doesNotThrow(() => matchExpression(raw));
        assert.match(matchExpression(raw), /^".*"\*$/);
    }
    // Кавычка удваивается — иначе она закрыла бы фразу досрочно.
    assert.equal(matchExpression('то"се'), '"то""се"*');
});

test("фрагмент раскладывается на найденное и остальное", () => {
    const snippet = `Го́споди, ${HIT_OPEN}воззва́х${HIT_CLOSE} к Тебе́`;
    assert.deepEqual(splitSnippet(snippet), [
        { text: "Го́споди, ", hit: false },
        { text: "воззва́х", hit: true },
        { text: " к Тебе́", hit: false },
    ]);
});

test("фрагмент с несколькими совпадениями чередуется правильно", () => {
    const snippet = `${HIT_OPEN}а${HIT_CLOSE} б ${HIT_OPEN}в${HIT_CLOSE}`;
    assert.deepEqual(splitSnippet(snippet).map(p => p.hit), [true, false, true]);
});

test("пустого фрагмента не бывает", () => {
    assert.deepEqual(splitSnippet(null), []);
    assert.deepEqual(splitSnippet(""), []);
});

test("фильтры уходят плейсхолдерами, а не подстановкой", () => {
    const conditions = conditionsFor({ book: "menaion", month: 9, sign: "polieley" });
    assert.equal(conditions.length, 3);
    for (const c of conditions) {
        assert.match(c.sql, /\?$/, "значение обязано уходить плейсхолдером");
    }
    assert.deepEqual(conditions.map(c => c.value), ["menaion", 9, "polieley"]);
});

test("незаданные фильтры не превращаются в условия", () => {
    // Иначе пустая строка из формы стала бы условием «book = ''» и обнулила выдачу.
    assert.deepEqual(conditionsFor({}), []);
    assert.deepEqual(conditionsFor({ book: "", month: null, day: undefined }), []);
});

test("ноль — это значение, а не пустота", () => {
    // День и глас нулём не бывают, а вот песнь канона — бывает: проверка на
    // «пусто» не должна отбрасывать законный ноль.
    assert.deepEqual(conditionsFor({ tone: 0 }).map(c => c.value), [0]);
});
