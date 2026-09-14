import { test } from "node:test";
import assert from "node:assert/strict";
import { coordinate, namesWithSynonyms, placeCoordinates, toLocation } from "@/lib/places/legacy";

test("координата: строка, число, мусор", () => {
    assert.equal(coordinate("39.9199"), 39.9199);
    assert.equal(coordinate(" 31,2 "), 31.2);
    assert.equal(coordinate(29.9), 29.9);
    assert.equal(coordinate(""), null);
    assert.equal(coordinate("восток"), null);
    assert.equal(coordinate(undefined), null);
    assert.equal(coordinate(NaN), null);
});

test("точка GeoJSON: долгота первой, вне пределов — нет точки", () => {
    assert.deepEqual(toLocation("39.9199", "32.8543"), { type: "Point", coordinates: [32.8543, 39.9199] });
    assert.equal(toLocation("132.8", "39.9"), null);
    assert.equal(toLocation("39.9", ""), null);
});

test("координаты места: location главнее старых полей", () => {
    assert.deepEqual(
        placeCoordinates({ location: { type: "Point", coordinates: [10, 20] }, latitude: "1", longitude: "2" }),
        { latitude: 20, longitude: 10 },
    );
    assert.deepEqual(placeCoordinates({ latitude: "1", longitude: "2" }), { latitude: 1, longitude: 2 });
    assert.equal(placeCoordinates({}), null);
});

test("синонимы в имена: без дублей, импортированные имена целы, удалённый вариант не воскресает", () => {
    const names = namesWithSynonyms(
        [
            { name: "Ἄγκυρα", lang: "grc", role: "historical", source: "pleiades" },
            { name: "Агкира", lang: "ru", role: "variant", source: "editor" },
        ],
        ["Анкира", " анкира ", "Анкара", ""],
        "Анкара",
    );
    assert.deepEqual(names.map((n) => [n.name, n.role]), [
        ["Ἄγκυρα", "historical"],
        ["Анкира", "variant"],
    ]);
});
