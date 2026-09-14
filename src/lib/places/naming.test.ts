import { test } from "node:test";
import assert from "node:assert/strict";
import { displayNames, hasCyrillic, shortName } from "@/lib/places/naming";

test("короткое имя — только у меток Wikidata, и только без прилагательного, «Тель» и скобок", () => {
    const wd = (name: string) => shortName({ id: "x", name, nameSource: "wikidata" });
    assert.equal(wd("Хорив (гора)"), "Хорив");
    assert.equal(wd("Древний Египет"), "Египет");
    assert.equal(wd("Тель Беэр-Шева"), "Беэр-Шева");
    assert.equal(wd("Тель-Хацор"), "Хацор");
    assert.equal(wd("Аммон (царство)"), "Аммон");
    // Имя целиком: без первого слова остался бы родительный падеж.
    assert.equal(wd("Город Давида"), "Город Давида");
    assert.equal(wd("Держава Ахеменидов"), "Держава Ахеменидов");
    assert.equal(wd("Долина полчища Гогова"), "Долина полчища Гогова");
    assert.equal(wd("Тель ер-Ретаба"), "Тель ер-Ретаба");
    assert.equal(shortName({ id: "3", name: "Авва (город)", nameSource: "nikifor" }), "Авва (город)");
    assert.equal(shortName({ id: "4", name: "Анкара" }), "Анкара");
});

test("совпавшее короткое имя остаётся с уточнением", () => {
    const names = displayNames([
        { id: "a", name: "Древний Египет", nameSource: "wikidata" },
        { id: "b", name: "Эллинистический Египет", nameSource: "wikidata" },
        { id: "c", name: "Хорив (гора)", nameSource: "wikidata" },
        { id: "d", name: "Язер (город)", nameSource: "wikidata" },
        { id: "e", name: "Язер", nameSource: "nikifor" },
    ]);
    assert.equal(names.get("a"), "Древний Египет");
    assert.equal(names.get("b"), "Эллинистический Египет");
    assert.equal(names.get("c"), "Хорив");
    assert.equal(names.get("d"), "Язер (город)");
    assert.equal(names.get("e"), "Язер");
});

test("кириллица", () => {
    assert.equal(hasCyrillic("Beth-arabah"), false);
    assert.equal(hasCyrillic("Беф-Арава"), true);
    assert.equal(hasCyrillic(undefined), false);
});
