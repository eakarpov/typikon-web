import { test } from "node:test";
import assert from "node:assert/strict";
import { enrichUpdate, factsFromRows, namesFromFacts, parseWktPoint, successionPairs } from "@/lib/places/wikidata";

const uri = (qid: string) => ({ value: `http://www.wikidata.org/entity/${qid}` });

test("точка из WKT: долгота первой, мусор — нет точки", () => {
    assert.deepEqual(parseWktPoint("Point(32.85 39.93)"), { type: "Point", coordinates: [32.85, 39.93] });
    assert.equal(parseWktPoint("Point(39.93 132.85)"), undefined);
    assert.equal(parseWktPoint(undefined), undefined);
});

// Анкара в Wikidata: официальные имена с датами, «заменяет» Анкиру.
const ankara = () => factsFromRows(
    [
        { item: uri("Q3640"), labelRu: { value: "Анкара" }, coord: { value: "Point(32.85 39.93)" }, pleiades: undefined },
        { item: uri("Q3640"), labelRu: { value: "Анкара" }, coord: { value: "Point(32.86 39.94)" } },
    ],
    [
        { item: uri("Q3640"), kind: { value: "official" }, value: { value: "Angora", "xml:lang": "tr" }, end: { value: "1930-03-28T00:00:00Z" } },
        { item: uri("Q3640"), kind: { value: "official" }, value: { value: "Ankara", "xml:lang": "tr" }, start: { value: "1930-03-28T00:00:00Z" } },
        { item: uri("Q3640"), kind: { value: "alias" }, value: { value: "Ангора" } },
        { item: uri("Q3640"), kind: { value: "replaces" }, value: uri("Q107585355") },
        { item: uri("Q107585355"), kind: { value: "replacedBy" }, value: uri("Q3640") },
    ],
).get("Q3640")!;

test("факты: первая точка, имена с годами, связь без дублей", () => {
    const f = ankara();
    assert.deepEqual(f.location?.coordinates, [32.85, 39.93]);
    assert.deepEqual(f.officialNames, [
        { name: "Angora", lang: "tr", to: 1930 },
        { name: "Ankara", lang: "tr", from: 1930 },
    ]);
    assert.deepEqual(f.replaces, ["Q107585355"]);
});

test("преемственность: «заменяет» и «заменён на» — одна пара", () => {
    const facts = factsFromRows([], [
        { item: uri("Q3640"), kind: { value: "replaces" }, value: uri("Q107585355") },
        { item: uri("Q107585355"), kind: { value: "replacedBy" }, value: uri("Q3640") },
    ]);
    assert.deepEqual(successionPairs(facts.values()), [["Q3640", "Q107585355"]]);
});

test("роли имён: у живого города метка современная, имя с концом — историческое", () => {
    const names = namesFromFacts(ankara(), false);
    assert.deepEqual(names.map((n) => `${n.name}/${n.lang}/${n.role}`), [
        "Анкара/ru/modern",
        "Angora/tr/historical",
        "Ankara/tr/modern",
        "Ангора/ru/variant",
    ]);
    assert.equal(namesFromFacts(ankara(), true)[0].role, "historical");
    const ancyra = { ...ankara(), qid: "Q107585355", labelRu: undefined, labelEn: "Ancyra", officialNames: [], aliasesRu: [] };
    assert.deepEqual(namesFromFacts(ancyra, true).map((n) => `${n.name}/${n.lang}/${n.role}`), ["Ancyra/en/historical"]);
});

test("обновление: имя импорта заменяется, имя редактора и чужая точка — нет", () => {
    const facts = ankara();
    const imported = enrichUpdate({ name: "Ancyra", nameSource: "openbible", ancient: false, names: [
        { name: "Ancyra", lang: "en", role: "biblical", source: "openbible" },
        { name: "Старое", lang: "ru", role: "variant", source: "wikidata" },
    ] }, facts);
    assert.equal(imported.name, "Анкара");
    assert.equal(imported.nameSource, "wikidata");
    assert.deepEqual(imported.location?.coordinates, [32.85, 39.93]);
    assert.equal(imported.names[0].name, "Ancyra");
    assert.equal(imported.names.some((n) => n.name === "Старое"), false);

    const manual = enrichUpdate({
        name: "Анкара", ancient: false,
        location: { type: "Point", coordinates: [1, 2] },
    }, { ...facts, pleiades: "638753" });
    assert.equal(manual.name, undefined);
    assert.equal(manual.location, undefined);
    assert.equal(manual.pleiades, "638753");
});
