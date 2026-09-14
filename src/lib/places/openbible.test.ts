import { test } from "node:test";
import assert from "node:assert/strict";
import { ancientRelationOf, buildPlan, confidenceOf, displayName, kindOf, ObAncient, ObModern, precisionOf } from "@/lib/places/openbible";

test("балл в достоверность: пороги 100 / 300 / 800", () => {
    assert.equal(confidenceOf(undefined), null);
    assert.equal(confidenceOf(99), null);
    assert.equal(confidenceOf(100), "disputed");
    assert.equal(confidenceOf(300), "probable");
    assert.equal(confidenceOf(800), "certain");
});

test("шаблоны описаний связей между древними местами", () => {
    const a = '<ancient id="a1">Megiddo</ancient>';
    assert.equal(ancientRelationOf(`another name for ${a}`), "identified_with");
    assert.equal(ancientRelationOf(`another name for the ${a}`), "identified_with");
    assert.equal(ancientRelationOf(a), "identified_with");
    assert.equal(ancientRelationOf(`in the ${a}`), "located_in");
    assert.equal(ancientRelationOf(`within 5 km of ${a}`), "near");
    assert.equal(ancientRelationOf(`about 2 km around ${a}`), "near");
    assert.equal(ancientRelationOf(`somewhere past ${a}`), null);
});

test("род, точность, имя", () => {
    assert.equal(kindOf("wadi"), "river");
    assert.equal(kindOf("campsite"), "settlement");
    assert.equal(kindOf("special"), "other");
    assert.equal(precisionOf(250, "settlement"), "exact");
    assert.equal(precisionOf(1000, "distance"), "approx");
    assert.equal(precisionOf(50, "region"), "area");
    assert.equal(displayName("Bethlehem 1"), "Bethlehem");
    assert.equal(displayName("Ai"), "Ai");
});

const modern = (id: string, over: Partial<ObModern> = {}): ObModern => ({
    id, friendly_id: id, type: "settlement", lonlat: "35.2,31.7",
    names: [{ name: id, type: "modern" }], precision: { type: "settlement", meters: 250 }, ...over,
});

test("план: сведение по общему QID, связи, «не место», конфликт ключей", () => {
    const ancients: ObAncient[] = [
        {
            id: "a1", friendly_id: "Bethlehem 1", types: ["settlement"],
            linked_data: { s7cc8b2: { id: "Q5776" } },
            modern_associations: { m1: { name: "Bethlehem", score: 1000 } },
            translation_name_counts: { "Beth-lehem": 26, Bethlehem: 411 },
            verses: [{ osis: "Matt.2.1" }, { osis: "Mic.5.2" }],
        },
        {
            id: "a2", friendly_id: "Ephrathah", types: ["settlement"],
            identifications: [{ id: "a1", id_source: "ancient", description: 'another name for <ancient id="a1">Bethlehem</ancient>', score: { time_total: 900 } }],
            modern_associations: { m1: { name: "Bethlehem", score: 600 }, m2: { name: "Tel X", score: 50 } },
            linked_data: { s7cc8b2: { id: "Q5776" } },
        },
        {
            id: "a3", friendly_id: "Addon", types: ["special"],
            identifications: [{ id: "x", id_source: "special", description: "not a place (person)" }],
        },
        {
            id: "a4", friendly_id: "Gilgal", types: ["settlement"],
            modern_associations: { m3: { name: "Tell A", score: 400 }, m4: { name: "Tell B", score: 150 } },
        },
    ];
    const moderns = [
        modern("m1", { coordinates_source: { type: "wikidata", id: "Q5776" } }),
        modern("m2"),
        modern("m3", { precision: { type: "tel", meters: 50 } }),
        modern("m4", { lonlat: "не точка" }),
    ];

    const plan = buildPlan(ancients, moderns);

    assert.deepEqual(plan.report.notAPlace, ["Addon"]);
    assert.equal(plan.report.merged, 1);
    assert.equal(plan.report.lowScoreDropped, 1);
    assert.equal(plan.report.unusedModern, 1);

    const bethlehem = plan.places.find((p) => p.keys.includes("a1"))!;
    assert.deepEqual(bethlehem.keys, ["a1", "m1"]);
    assert.equal(bethlehem.name, "Bethlehem");
    assert.equal(bethlehem.names[0].name, "Bethlehem");
    assert.equal(bethlehem.status, "extant");
    assert.deepEqual(bethlehem.location?.coordinates, [35.2, 31.7]);
    assert.deepEqual(bethlehem.externals.map((e) => `${e.source}:${e.id}`), ["openbible:a1", "wikidata:Q5776", "openbible:m1"]);

    // Второе древнее место с тем же QID ключа не получает — он уже занят.
    const ephrathah = plan.places.find((p) => p.keys.includes("a2"))!;
    assert.deepEqual(ephrathah.externals.map((e) => e.source), ["openbible"]);
    assert.equal(plan.report.qidConflicts.length, 1);

    // Точка, сведённая с Вифлеемом, стала им самим: связь идёт на запись a1.
    const rel = plan.relations.map((r) => `${r.from}>${r.to}:${r.type}:${r.confidence}`).sort();
    assert.deepEqual(rel, [
        "a2>a1:identified_with:certain",
        "a4>m3:identified_with:probable",
        "a4>m4:identified_with:disputed",
    ]);

    const gilgal = plan.places.find((p) => p.keys.includes("m3"))!;
    assert.equal(gilgal.status, "ruins");
    assert.equal(plan.places.find((p) => p.keys.includes("m4"))!.location, undefined);

    assert.equal(plan.verses.length, 2);
    assert.equal(plan.places.some((p) => p.keys.includes("a3")), false);
});
