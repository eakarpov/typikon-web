import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanReadingPlace, readingPersons } from "./reader";
import type { PomyannikPerson } from "./types";
const entry = (id: string, kind: string, groups: string[]) => ({ id, kind, groups } as PomyannikPerson);

describe("место чтения", () => {
    it("проверяет id и контекст, не принимает произвольные поля", () => {
        const place = { personId: "1234567890abcdef12345678", group: "Семья", kind: "living" };
        assert.deepEqual(cleanReadingPlace({ ...place, userId: "foreign" }), place);
        for (const raw of [null, {}, { ...place, kind: "other" }, { ...place, personId: "bad" }, { ...place, group: "a".repeat(41) }]) assert.equal(cleanReadingPlace(raw), null);
    });
    it("сначала читает здравие, затем упокоение, сохраняя ручной порядок каждого раздела", () => {
        const persons = [entry("d", "departed", ["Семья"]), entry("b", "living", []), entry("a", "living", ["Семья"])];
        assert.deepEqual(readingPersons(persons, "", "all").map(p => p.id), ["b", "a", "d"]);
        assert.deepEqual(readingPersons(persons, "Семья", "all").map(p => p.id), ["a", "d"]);
        assert.deepEqual(readingPersons(persons, "Семья", "departed").map(p => p.id), ["d"]);
        assert.deepEqual(readingPersons(persons, "Крестники", "all"), []);
        assert.deepEqual(persons.map(p => p.id), ["d", "b", "a"]);
    });
});
