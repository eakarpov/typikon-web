import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BackupError, MAX_BACKUP_BYTES, makeBackup, parseBackup, planRestore } from "./backup";
import { MAX_PERSONS, type PomyannikPerson } from "./types";

const person = (over: Partial<PomyannikPerson> = {}): PomyannikPerson => ({
    id: "1234567890abcdef12345678", userId: "private-owner", name: "Юрий", nameKey: "юрий", churchName: "Георгий",
    kind: "living", sex: "m", rank: "voin", relation: "дядя", signature: "Иванов",
    born: "1980-02-29", baptized: "1990-05-15", died: null,
    nameDay: { source: "manual", style: "old", month: 4, day: 23, saint: "Георгий Победоносец" },
    sorokoust: { from: "2026-11-01", where: "Храм" }, groups: ["Родные", "Друзья"], order: 7,
    createdAt: new Date(), updatedAt: new Date(), ...over,
});

describe("резервная копия помянника", () => {
    it("сохраняет переносимые поля и порядок, исключает владельца и служебные данные", () => {
        const backup = makeBackup([person(), person({ name: "Николай", kind: "departed", died: "2020-03-05", nameDay: { source: "auto", offset: -7, saint: "Святой" } })]);
        assert.deepEqual(parseBackup(JSON.parse(JSON.stringify(backup))), backup);
        const serialized = JSON.stringify(backup);
        for (const key of ["private-owner", "nameKey", "createdAt", "updatedAt", "1234567890abcdef12345678"]) assert.equal(serialized.includes(key), false);
        assert.equal(backup.persons[0].signature, "Иванов");
        assert.deepEqual(backup.persons[0].nameDay, person().nameDay);
        assert.deepEqual(backup.persons[0].groups, ["Родные", "Друзья"]);
        assert.equal(backup.persons[1].died, "2020-03-05");
    });
    it("принимает пустую копию и старую карточку без подписи", () => {
        assert.equal(parseBackup(makeBackup([])).persons.length, 0);
        assert.equal(makeBackup([person({ signature: undefined })]).persons[0].signature, null);
    });
    it("отвергает неверную версию, структуру и превышение предела", () => {
        for (const raw of [null, [], {}, { ...makeBackup([]), version: 3 }, { ...makeBackup([]), persons: Array(MAX_PERSONS + 1).fill(person()) }]) assert.throws(() => parseBackup(raw), BackupError);
    });
    it("проверяет каждую карточку целиком до восстановления", () => {
        for (const patch of [ { name: " " }, { name: 123 }, { kind: "other" }, { rank: "__proto__" }, { sex: "other" },
            { born: "2025-02-29" }, { died: "2020-01-01" }, { groups: [42] }, { groups: Array(11).fill("род") },
            { signature: "x".repeat(121) }, { sorokoust: { where: "Храм" } },
            { nameDay: { source: "manual", style: "old", month: 2, day: 30 } }, { nameDay: { source: "auto", offset: 201 } } ]) {
            assert.throws(() => parseBackup({ ...makeBackup([]), persons: [person(), { ...person(), ...patch }] }), /Запись 2:/);
        }
    });
    it("не переносит произвольные поля из файла в документы", () => {
        const backup = parseBackup({ ...makeBackup([]), persons: [{ ...person(), userId: "foreign", _id: "foreign", deleted: true, $set: { name: "чужой" } }] });
        assert.equal("userId" in backup.persons[0], false);
        assert.equal("_id" in backup.persons[0], false);
        assert.equal("$set" in backup.persons[0], false);
    });
});

describe("план восстановления", () => {
    it("восстанавливает весь список и не обрезает его до лимита массового ввода", () => {
        const input = makeBackup(Array.from({ length: 500 }, (_, i) => person({ signature: `человек ${i}` })));
        const plan = planRestore([], input.persons);
        assert.equal(plan.additions.length, 500);
        assert.equal(plan.additions[499].signature, "человек 499");
    });
    it("экспортирует и восстанавливает все 10 000 карточек в пределах размера файла", () => {
        const persons = Array.from({ length: MAX_PERSONS }, (_, i) => person({ signature: `человек ${i}` }));
        const serialized = JSON.stringify(makeBackup(persons), null, 2);
        assert.ok(Buffer.byteLength(serialized, "utf8") < MAX_BACKUP_BYTES);
        const backup = parseBackup(JSON.parse(serialized));
        assert.equal(backup.persons.length, 10000);
        const plan = planRestore([], backup.persons);
        assert.equal(plan.additions.length, 10000);
        assert.equal(plan.additions[9999].signature, "человек 9999");
    });

    it("повторное восстановление не добавляет точные копии", () => {
        const input = makeBackup([person(), person({ name: "Николай" })]);
        assert.equal(planRestore([person()], input.persons).additions.length, 1);
        const result = planRestore([person(), person({ name: "Николай" })], input.persons);
        assert.equal(result.additions.length, 0);
        assert.equal(result.skipped, 2);
    });
    it("сохраняет кратность одинаковых карточек и различает одноимённых людей", () => {
        const input = makeBackup([person(), person(), person({ signature: "Петров" })]);
        const plan = planRestore([person()], input.persons);
        assert.deepEqual(plan.additions.map(p => p.signature), ["Иванов", "Петров"]);
        assert.equal(plan.skipped, 1);
    });
    it("не переписывает изменённую карточку, сохраняет ручные именины", () => {
        const current = [person({ relation: "крёстный" })];
        const before = JSON.stringify(current);
        const plan = planRestore(current, makeBackup([person()]).persons);
        assert.equal(plan.additions.length, 1);
        assert.equal(plan.additions[0].nameDay?.source, "manual");
        assert.equal(JSON.stringify(current), before);
    });
});
