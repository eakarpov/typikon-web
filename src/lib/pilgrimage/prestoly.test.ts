import { test } from "node:test";
import assert from "node:assert/strict";
import { thronesOfText } from "./prestoly";
import { textOf } from "./crawl";

/** Ключи престолов; звёздочкой помечен главный. */
const slugs = (text: string) =>
    thronesOfText(text).map((g) => `${g.dedication}${g.isMain ? "*" : ""}`);

test("перечень престолов: главный первый, придел за ним", () => {
    assert.deepEqual(
        slugs("Престолы: святителя Николая Чудотворца, великомученицы Варвары."),
        ["nikolay-chudotvorec*", "varvara"],
    );
});

test("главный престол и придел в разных предложениях", () => {
    assert.deepEqual(
        slugs("Главный престол освящён в честь Успения Пресвятой Богородицы. "
            + "Правый придел — во имя святителя Николая."),
        ["uspenie*", "nikolay-chudotvorec"],
    );
});

test("сокращение «св.» не обрывает имя престола", () => {
    assert.deepEqual(
        slugs("Правый придел во имя св. Николая Чудотворца."),
        ["nikolay-chudotvorec"],
    );
});

test("«престольный праздник» — не перечень престолов", () => {
    assert.deepEqual(slugs("Престольный праздник — 6 декабря."), []);
});

test("перечень строками списка", () => {
    assert.deepEqual(
        slugs("Престолы:\nсвятителя Николая\nвеликомученицы Варвары"),
        ["nikolay-chudotvorec*", "varvara"],
    );
});

test("перечень из разметки: пункты списка", () => {
    const html = "<h2>Престолы</h2><ul><li>святителя Николая Чудотворца</li>"
        + "<li>великомученицы Варвары</li></ul>";
    assert.deepEqual(
        slugs(textOf(html)),
        ["nikolay-chudotvorec*", "varvara"],
    );
});

test("порядок главного решает текст, а не привычка", () => {
    assert.deepEqual(
        slugs("Престолы: великомученицы Варвары, святителя Николая Чудотворца."),
        ["varvara*", "nikolay-chudotvorec"],
    );
});

test("придельная и главная пометы внутри одного отрывка", () => {
    assert.deepEqual(
        slugs("Престолы: придельный — святителя Николая, главный — Успения Пресвятой Богородицы."),
        ["nikolay-chudotvorec", "uspenie*"],
    );
});

test("«второй престол» главным не становится", () => {
    assert.deepEqual(slugs("Второй престол — святителя Николая."), ["nikolay-chudotvorec"]);
});

test("заглушка Богородицы не лезет вторым престолом", () => {
    assert.deepEqual(
        slugs("Придел в честь Казанской иконы Божией Матери."),
        ["ikona-kazanskaya"],
    );
});

test("освящение во имя без слова «престол»", () => {
    assert.deepEqual(slugs("Храм освящён во имя Святой Троицы."), ["troica*"]);
});

test("год освящения и «в честь победы» престолом не становятся", () => {
    assert.deepEqual(slugs("Храм освящён в 1903 году в честь победы в войне 1812 года."), []);
});
