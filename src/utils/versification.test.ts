import { test } from "node:test";
import assert from "node:assert/strict";
import {
    DEFAULT_PERICOPE_VERSIFICATION, REFERENCE_VERSIFICATION_ID, VERSIFICATIONS,
    pericopeResolvesDirectly, pericopeVersification, versification,
} from "@/utils/versification";
import { BIBLE_MAPPINGS } from "@/lib/bible/mappings";

// Основа нумерации — не украшение, а условие правильности чтения: «Притч. 30:1»
// значит разные стихи в славянском и греческом счёте.

test("эталон ровно один", () => {
    const references = VERSIFICATIONS.filter((v) => v.reference);
    assert.equal(references.length, 1, "эталон должен быть один: в нём записан canonRef всех изданий");
    assert.equal(REFERENCE_VERSIFICATION_ID, "sla-lxx");
});

test("идентификаторы традиций уникальны", () => {
    const ids = VERSIFICATIONS.map((v) => v.id);
    assert.equal(new Set(ids).size, ids.length);
});

test("зачало без пометки считается славянским", () => {
    assert.equal(pericopeVersification({}), "sla-lxx");
    assert.equal(pericopeVersification({ versification: null }), "sla-lxx");
    assert.equal(DEFAULT_PERICOPE_VERSIFICATION, REFERENCE_VERSIFICATION_ID,
        "пока умолчание совпадает с эталоном, старые зачала резолвятся как раньше");
});

test("зачало чужого счёта напрямую не резолвится", () => {
    assert.equal(pericopeResolvesDirectly({}), true, "наши зачала — славянские, идут напрямую");
    assert.equal(pericopeResolvesDirectly({ versification: "sla-lxx" }), true);
    assert.equal(pericopeResolvesDirectly({ versification: "grc-lxx" }), false,
        "греческий счёт сперва надо привести к эталону, а правил для этого нет");
});

// Словарь традиций общий у изданий и у зачал. Разойдись он — сверять их стало
// бы нечем, а расхождение обнаружилось бы не здесь, а в съехавшем чтении.
test("правила приведения ссылаются на известные издания, а не на выдуманные", () => {
    const editions = new Set(BIBLE_MAPPINGS.map((rule) => rule.edition));
    assert.ok(editions.size >= 2);
    editions.forEach((code) => {
        assert.ok(code.length > 0, "у правила должен быть код издания");
    });
});

test("традиция находится по коду, незнакомая отдаётся как null", () => {
    assert.equal(versification("grc-lxx")?.reference, false);
    assert.equal(versification("sla-lxx")?.reference, true);
    assert.equal(versification("выдумка"), null);
});
