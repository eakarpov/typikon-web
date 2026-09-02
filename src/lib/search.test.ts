import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSearchFields, normalizeQuery, snippetFor } from "@/lib/search";
import { normalizeChurchSlavonic } from "@/utils/churchSlavonic";

test("ударение внутри слова снимается", () => {
    // Ради этого поиск и переписан: «стра́жи» — это с,т,р,а,U+0301,ж,и,
    // и без нормализации запрос «стражи» с ним не совпадает.
    assert.equal(normalizeChurchSlavonic("На стра́жи мое́й ста́ну"), "на стражи моеи стану");
});

test("ЦС-графика приводится к гражданской", () => {
    assert.equal(normalizeChurchSlavonic("і҆ѡа́нна"), "иоанна");
    assert.equal(normalizeChurchSlavonic("вкра́тцѣ"), "вкратце");
    assert.equal(normalizeChurchSlavonic("и҆гꙋ́мена"), "игумена");
    assert.equal(normalizeChurchSlavonic("ст҃ы́ѧ"), "стыя");
    assert.equal(normalizeChurchSlavonic("ѿ"), "от");
});

test("диграф «ук» складывается в одну букву", () => {
    // «ᲂу» — это U+1C82 и «у», одна буква на два символа. Посимвольно она
    // сложилась бы в «оу» и не сошлась бы с гражданским «у»: так набраны
    // 90 текстов корпуса, и поиск не находил их вовсе.
    assert.equal(normalizeChurchSlavonic("ᲂу҆слы́ши"), "услыши");
    assert.equal(normalizeChurchSlavonic("ᲂу҆бо"), "убо");
    // Сам по себе U+1C82 — просто «о», и диграф этого не отменяет.
    assert.equal(normalizeChurchSlavonic("ᲂ"), "о");
});

test("ё и регистр не мешают совпадению", () => {
    assert.equal(normalizeQuery("Всё"), "все");
    assert.equal(normalizeQuery("  ПаСха   Христова "), "пасха христова");
});

test("запрос и текст сходятся после нормализации", () => {
    const fields = buildSearchFields({ name: "Ме́сяца ма́рта", content: "На стра́жи мое́й ста́ну" });
    assert.ok(fields.searchContent.includes(normalizeQuery("стражи")));
    assert.ok(fields.searchName.includes(normalizeQuery("месяца")));
});

test("в поисковые поля попадает не только тело", () => {
    const fields = buildSearchFields({
        name: "Название",
        description: "Описание",
        content: "Тело",
        author: "Иоанн Златоуст",
        poems: "Стихи",
    });
    assert.ok(fields.searchName.includes("описание"), "описание ищется вместе с названием");
    assert.ok(fields.searchContent.includes("иоанн златоуст"), "автор ищется вместе с телом");
    assert.ok(fields.searchContent.includes("стихи"));
});

test("фрагмент вырезается из исходного текста, а не из нормализованного", () => {
    const content = "И҆ речѐ на стра́жи мое́й ста́ну, глаго́лет чу́дный Авваку́м, и аз с ним днесь";
    const snippet = snippetFor(content, "стражи");

    assert.ok(snippet, "фрагмент должен найтись");
    // Ищем по нормализованному, показываем — как написано, с ударением.
    assert.ok(snippet!.includes("стра́жи"), `в фрагменте нет исходного написания: ${snippet}`);
});

test("фрагмент находится и в тексте ЦС-графики", () => {
    const content = "Житїѐ вкра́тцѣ а҆́ввы і҆ѡа́нна и҆гꙋ́мена ст҃ы́ѧ горы̀ сїна́йскїѧ";
    const snippet = snippetFor(content, "игумена");

    assert.ok(snippet, "фрагмент должен найтись по гражданскому написанию");
    assert.ok(snippet!.includes("и҆гꙋ́мена"), `в фрагменте нет исходного написания: ${snippet}`);
});

test("фрагмента нет, если слова в тексте нет", () => {
    assert.equal(snippetFor("Совсем другой текст", "аввакум"), null);
    assert.equal(snippetFor("", "аввакум"), null);
    assert.equal(snippetFor(null, "аввакум"), null);
});

test("короткие слова во фрагменте игнорируются", () => {
    // Иначе предлог «на» вырезал бы фрагмент в первом попавшемся месте.
    assert.equal(snippetFor("На стра́жи мое́й", "на"), null);
});

test("длинный текст обрезается с многоточиями", () => {
    const content = `${"слово ".repeat(60)}Авваку́м${" слово".repeat(60)}`;
    const snippet = snippetFor(content, "аввакум");

    assert.ok(snippet);
    assert.ok(snippet!.startsWith("…"), "слева должно быть многоточие");
    assert.ok(snippet!.endsWith("…"), "справа должно быть многоточие");
    assert.ok(snippet!.length < 260, `фрагмент слишком длинный: ${snippet!.length}`);
});

test("спецсимволы в запросе не роняют поиск фрагмента", () => {
    // Запрос попадает в регулярку — если не экранировать, скобки и звёздочки бросают
    // исключение и поиск падает целиком.
    assert.doesNotThrow(() => snippetFor("текст", "(*+["));
    assert.doesNotThrow(() => snippetFor("текст", "\\"));
});

// Одно и то же ударение юникод записывает двояко: «ά» — U+1F71 (оксия, блок Greek
// Extended) и U+03AC (тонос). Греческое издание приведено к NFC, то есть к тоносу,
// а прежде было записано оксией. Нормализатор снимает диакритику через NFD и потому
// обе записи видит одинаково — иначе перевод издания в NFC тихо сломал бы поиск по
// прежде набранным строкам.
test("греческое слово находится и старой записью, и новой", () => {
    const oxia = "\u03c4\u03bf\u03c0\u1f71\u03b6\u03b9\u03bf\u03bd";
    const tonos = "\u03c4\u03bf\u03c0\u03ac\u03b6\u03b9\u03bf\u03bd";

    assert.notEqual(oxia, tonos, "строки должны различаться побайтово");
    assert.equal(normalizeQuery(oxia), normalizeQuery(tonos));
});

test("то же для составного и предсоставленного написания", () => {
    assert.equal(
        normalizeQuery("\u03ac"),            // ά одним знаком
        normalizeQuery("\u03b1\u0301"),     // α + комбинирующая оксия
    );
});

test("церковнославянское ударение снимается при любой записи", () => {
    assert.equal(normalizeQuery("стра\u0301жи"), normalizeQuery("стражи"));
});
