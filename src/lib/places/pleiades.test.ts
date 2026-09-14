import { test } from "node:test";
import assert from "node:assert/strict";
import { CsvRow, locationFromRow, namesFromRows, periodsFromKeys, pidOf } from "@/lib/places/pleiades";

test("pid из пути", () => {
    assert.equal(pidOf("/places/619103"), "619103");
    assert.equal(pidOf("/places/619103/"), "619103");
});

// Строки имён Анкиры из дампа (сокращено).
const ancyra: CsvRow[] = [
    { title: "Ankyra", nameAttested: "Ἄγκυρα", nameTransliterated: "Ankyra", nameLanguage: "grc", minDate: "-1200", maxDate: "1450" },
    { title: "Ancyra", nameAttested: "Ancyra", nameTransliterated: "Ancyra", nameLanguage: "la", minDate: "-330", maxDate: "640" },
    { title: "Angora", nameTransliterated: "Angora", nameLanguage: "grc", minDate: "1683", maxDate: "1918" },
    { title: "Ankara", nameTransliterated: "Ankara", nameLanguage: "tr", minDate: "1700", maxDate: "2100" },
    { title: "Ankara Z.A.", nameTransliterated: "Ankara Z.A.", nameLanguage: "tr", minDate: "1918", maxDate: "2000" },
    { title: "Anqīra", nameTransliterated: "Anqīra, Anqira", nameLanguage: "arb", minDate: "650", maxDate: "940" },
    { title: "Anqīra", nameTransliterated: "Anqīra", nameLanguage: "arb", minDate: "600", maxDate: "990" },
    { title: "Scanderia", nameAttested: "Scanderia", nameTransliterated: "Scanderia", nameLanguage: "en", minDate: "1700", maxDate: "1799" },
];

test("имена: письмо и транслитерация, слияние лет, экзонимы и «по сей день» отброшены", () => {
    const names = namesFromRows(ancyra);
    assert.deepEqual(names.map((n) => [n.name, n.lang, n.role, n.from, n.to, n.transliteration]), [
        ["Ἄγκυρα", "grc", "historical", -1200, 1450, "Ankyra"],
        ["Ancyra", "la", "historical", -330, 640, undefined],
        ["Anqīra", "arb", "historical", 600, 990, undefined],
        ["Angora", "grc", "historical", 1683, 1918, undefined],
        ["Ankara", "tr", "modern", 1700, undefined, undefined],
        ["Ankara Z.A.", "tr", "modern", 1918, undefined, undefined],
    ]);
    assert.ok(names.every((n) => n.source === "pleiades"));
});

test("периоды: только общие эпохи, по порядку", () => {
    assert.deepEqual(
        periodsFromKeys("late-antique,neo-assyrian-babylonian-middle-east,hellenistic-republican,roman").map((p) => p.label),
        ["эллинистическая эпоха", "римская эпоха", "поздняя античность"],
    );
    assert.deepEqual(periodsFromKeys(""), []);
});

test("точка: precise и rough берутся, related и unlocated — нет", () => {
    assert.deepEqual(locationFromRow({ locationPrecision: "precise", reprLat: "39.93", reprLong: "32.86" }),
        { location: { type: "Point", coordinates: [32.86, 39.93] }, precision: "exact" });
    assert.equal(locationFromRow({ locationPrecision: "rough", reprLat: "1", reprLong: "2" })?.precision, "approx");
    assert.equal(locationFromRow({ locationPrecision: "related", reprLat: "1", reprLong: "2" }), undefined);
    assert.equal(locationFromRow({ locationPrecision: "precise", reprLat: "", reprLong: "" }), undefined);
});
