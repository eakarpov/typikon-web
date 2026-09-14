import { test } from "node:test";
import assert from "node:assert/strict";
import { ArticleInfo, matchByVerses, normalizeName, PlaceInfo, refKeys, skeleton, soundsAlike } from "@/lib/places/nikifor";

test("ключи стихов: сокращения Викитеки, диапазон, глава без стиха", () => {
    assert.deepEqual(refKeys({ book: "4Цар", ref: "5:12" }), ["4-tsarstv.5.12"]);
    assert.deepEqual(refKeys({ book: "1Ездр", ref: "2:59-61" }), ["1-ezdry.2.59", "1-ezdry.2.60", "1-ezdry.2.61"]);
    assert.deepEqual(refKeys({ book: "Эсф", ref: "9:8" }), ["esfir.9.8"]);
    assert.deepEqual(refKeys({ book: "Быт", ref: "28" }), []);
    assert.deepEqual(refKeys({ book: "Неизвестно", ref: "1:1" }), []);
});

test("имена сравниваются без ё/й и дефисов", () => {
    assert.equal(normalizeName("Беф-Шемеш"), normalizeName("Бефшемеш"));
    assert.equal(normalizeName("Ефремовы горы"), normalizeName("ефремовы-горы"));
});

test("созвучие по синодальной передаче: верные пары из данных — да, ложные — нет", () => {
    assert.equal(skeleton("Beth-aven"), skeleton("Беф-Авен"));
    for (const [en, ru] of [["Abiezer", "Авиезер"], ["Argob", "Аргов"], ["Beth-peor", "Беф-Фегор"], ["Chebar", "Хевар"],
        ["Goshen", "Гошен"], ["Beth-car", "Вефхор"], ["Helkath-hazzurim", "Хелкаф-Хаццурим"], ["Geba", "Гева"]]) {
        assert.equal(soundsAlike(en, ru), true, `${en} ~ ${ru}`);
    }
    for (const [en, ru] of [["Addon", "Тел-Мехах"], ["Arad", "Хорма"], ["Gilgal", "Елисей"], ["Cush", "Гихон"], ["Gebal", "Тутовое дерево"]]) {
        assert.equal(soundsAlike(en, ru), false, `${en} ≁ ${ru}`);
    }
});

const set = (...keys: string[]) => new Set(keys);

test("по стихам: имя решает при общем стихе, без имени — только взаимная пара с отрывом", () => {
    const articles: ArticleInfo[] = [
        { alias: "nikifor-vefil", headword: "Вефиль", keys: set("bytie.28.19", "bytie.35.8") },
        { alias: "nikifor-gai", headword: "Гай", keys: set("iisus-navin.7.2", "iisus-navin.8.1", "iisus-navin.8.28") },
        { alias: "nikifor-aviasaf", headword: "Авиасаф", keys: set("iskhod.6.24", "iisus-navin.21.1") },
        { alias: "nikifor-argov", headword: "Аргов", keys: set("iisus-navin.21.1") },
    ];
    const places: PlaceInfo[] = [
        { id: "bethel", keys: set("bytie.28.19", "bytie.35.8", "sudi.1.22"), ruNames: ["Вефиль"] },
        { id: "ai", keys: set("iisus-navin.7.2", "iisus-navin.8.1", "iisus-navin.8.28", "bytie.12.8"), ruNames: [], latinNames: ["Ai"] },
        // Стих делят две статьи, но созвучна только одна — ей место и достаётся.
        { id: "argob", keys: set("iisus-navin.21.1"), ruNames: [], latinNames: ["Argob"] },
        // Общий стих без созвучия и без отрыва — ничьё.
        { id: "levite-city", keys: set("iisus-navin.21.1"), ruNames: [], latinNames: ["Kedemoth"] },
    ];
    const matches = matchByVerses(articles, places);
    assert.deepEqual(matches.map((m) => [m.placeId, m.alias, m.decision]), [
        ["bethel", "nikifor-vefil", "auto"],
        ["ai", "nikifor-gai", "auto"],
        ["argob", "nikifor-argov", "auto"],
    ]);
});

test("по стихам: два общих стиха без созвучия — на ревью", () => {
    const matches = matchByVerses(
        [{ alias: "nikifor-x", headword: "Икс", keys: set("sudi.1.1", "sudi.1.2") }],
        [{ id: "p", keys: set("sudi.1.1", "sudi.1.2"), ruNames: ["Игрек"], latinNames: ["Omega"] }],
    );
    assert.deepEqual(matches.map((m) => m.decision), ["pending"]);
});
