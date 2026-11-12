import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanGroups, cleanSignature, movePerson, personMatches, validPersonOrder } from "./organization";
import type { PomyannikPerson } from "./types";
import { snapshot } from "./note";

const person = (over: Partial<PomyannikPerson> = {}): PomyannikPerson => ({
    id: "1", userId: "u", name: "Юрий", nameKey: "юрий", churchName: "Георгий",
    kind: "living", sex: "m", rank: null, relation: "дядя", signature: "Фёдоров · университет",
    born: null, baptized: null, died: null, nameDay: null, sorokoust: null,
    groups: ["Семья", "Друзья"], order: 0, createdAt: new Date(), updatedAt: new Date(), ...over,
});

describe("подпись и группы", () => {
    it("чистит подпись и допускает её удаление", () => {
        assert.equal(cleanSignature("  Иванов\n  университет "), "Иванов университет");
        assert.equal(cleanSignature("  "), null);
        assert.equal(cleanSignature({ surname: "Иванов" }), null);
        assert.equal(cleanSignature("а".repeat(121))?.length, 120);
    });
    it("не размножает группы из-за регистра и пробелов, ограничивает длину и число", () => {
        assert.deepEqual(cleanGroups([" Семья ", "семья", "Крёстные", "Крестные", null, 4, ""]), ["Семья", "Крёстные"]);
        assert.equal(cleanGroups(Array.from({ length: 11 }, (_, i) => `группа ${i}`)).length, 10);
        assert.equal(cleanGroups(["а".repeat(45)])[0].length, 40);
        assert.deepEqual(cleanGroups(null), []);
    });
    it("не переносит подпись, родство и группы в церковную записку", () => {
        const note = snapshot(person());
        assert.equal("signature" in note, false);
        assert.equal("relation" in note, false);
        assert.equal("groups" in note, false);
    });
});

describe("поиск помянника", () => {
    it("ищет по мирскому и церковному имени, подписи, родству и группе", () => {
        for (const query of ["юрий", "ГЕОРГИЙ", "федоров", "дядя", "семья", "фёдоров университет"]) {
            assert.ok(personMatches(person(), query), query);
        }
        assert.equal(personMatches(person(), "Иванов"), false);
    });
    it("соединяет поиск и фильтр группы, поддерживает старые карточки без подписи", () => {
        assert.equal(personMatches(person(), "Георгий", "Семья"), true);
        assert.equal(personMatches(person(), "Георгий", "Крестники"), false);
        assert.equal(personMatches(person({ signature: undefined }), "Юрий"), true);
        assert.equal(personMatches(person(), "   "), true);
    });
});

describe("порядок имён", () => {
    it("отвергает чужие id, повторы, пропуски и неверный формат до записи", () => {
        const ids = ["a", "b", "c"];
        assert.ok(validPersonOrder(["c", "a", "b"], ids));
        for (const raw of [null, "a,b,c", ["a", "b"], ["a", "a", "c"], ["a", "b", "foreign"], ["a", "b", 3]]) {
            assert.equal(validPersonOrder(raw, ids), false);
        }
        assert.equal(validPersonOrder([], []), true);
    });
    it("двигает человека только внутри своего раздела и сохраняет все данные", () => {
        const persons = [person({ id: "a" }), person({ id: "d", kind: "departed" }), person({ id: "b" })];
        const moved = movePerson(persons, "b", -1);
        assert.deepEqual(moved.map(p => p.id), ["b", "d", "a"]);
        assert.equal(moved[1], persons[1]);
        assert.equal(moved[0], persons[2]);
        assert.deepEqual(persons.map(p => p.id), ["a", "d", "b"]);
        assert.deepEqual(movePerson(moved, "b", 1), persons);
    });
    it("на границе раздела и для неизвестного id ничего не меняет", () => {
        const persons = [person({ id: "a" }), person({ id: "d", kind: "departed" })];
        assert.equal(movePerson(persons, "a", -1), persons);
        assert.equal(movePerson(persons, "a", 1), persons);
        assert.equal(movePerson(persons, "missing", 1), persons);
    });
});
