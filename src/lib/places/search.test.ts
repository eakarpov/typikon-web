import { test } from "node:test";
import assert from "node:assert/strict";
import { haystackOf, matches, normalize } from "@/lib/places/search";

// Поиск места по имени. Ошибка здесь не видна ни в логе, ни на глаз: указатель
// отвечает, просто нужного места в нём нет — и читатель решает, что места у нас
// и не заведено.
//
// Одно правило на два клиента: по нему ищет страница сайта и ручка
// `/api/v2/places`, которой пользуется приложение. Разойдясь, они стали бы
// находить разное по одному запросу.

test("регистр не в счёт", () => {
    assert.equal(normalize("ИеруСалим"), "иерусалим");
});

test("«ё» и «е» — одна буква", () => {
    // В корпусе одно и то же имя записано и так и так, а наберёт читатель как
    // придётся.
    assert.equal(normalize("Ёлохово"), normalize("Елохово"));
});

test("пробелы и дефисы не разделяют", () => {
    assert.equal(normalize("Беф-Ель"), normalize("Беф Ель"));
    assert.equal(normalize("Беф-Ель"), normalize("Бефель"));
});

test("стог собирается из всех имён места, а не из одного нынешнего", () => {
    // В этом и смысл указателя: «Царьград» должен находить Константинополь.
    const haystack = haystackOf({
        name: "Константинополь",
        names: [
            { name: "Царьград", transliteration: "Tsargrad" },
            { name: "Византий" },
        ],
        synonyms: ["Стамбул"],
    });

    for (const query of ["Константинополь", "царьград", "Tsargrad", "византий", "стамбул"]) {
        assert.ok(matches(haystack, query), query);
    }
});

test("обрывок не перескакивает границу имён", () => {
    // Имена сшиты разделителем, а не пробелом. Сшив пробелом, мы получили бы
    // «римафины» и находили бы место по куску, которого ни в одном имени нет.
    const haystack = haystackOf({ name: "Рим", names: [{ name: "Афины" }] });

    assert.ok(matches(haystack, "рим"));
    assert.ok(matches(haystack, "афины"));
    assert.ok(!matches(haystack, "мафи"));
});

test("пустой запрос подходит всякому месту", () => {
    // Указатель открывается перечнем, а не пустым экраном: просмотр начинается
    // без слова, поиск его сужает.
    const haystack = haystackOf({ name: "Иерусалим" });

    assert.ok(matches(haystack, ""));
    assert.ok(matches(haystack, "   "));
});

test("место без прочих имён ищется по своему", () => {
    assert.ok(matches(haystackOf({ name: "Назарет" }), "наза"));
    assert.ok(!matches(haystackOf({ name: "Назарет" }), "вифлеем"));
});

test("пустых и отсутствующих имён стог не боится", () => {
    // Записи заводились руками и импортом: где-то `names` нет вовсе, где-то в
    // синонимах пустая строка.
    const haystack = haystackOf({
        name: "Ай",
        names: [{ name: null, transliteration: null }],
        synonyms: [null, ""],
    });

    assert.ok(matches(haystack, "ай"));
});
