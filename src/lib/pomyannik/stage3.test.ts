import { parseLine } from "./parse";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { personalDate, fullDate, dateParts } from "./dates";
import { effectiveRank, expiredRank } from "./marks";
import { duplicateCandidates, personsWithDuplicates } from "./duplicates";
import { moveToTrash, recoverFromTrash, TrashLimitError, type TrashStore } from "./trash";
import { upcoming, memorialDays } from "./reckoning";
import { makeBackup, parseBackup, planRestore } from "./backup";
import { snapshot } from "./note";
import type { PomyannikPerson } from "./types";
const person = (over: Partial<PomyannikPerson> = {}): PomyannikPerson => ({
    id: "aaaaaaaaaaaaaaaaaaaaaaaa", userId: "owner", name: "Александр", nameKey: "александр", churchName: null,
    kind: "living", sex: "m", rank: null, relation: null, signature: "Иванов", born: null, baptized: null, died: null,
    nameDay: null, sorokoust: null, groups: ["Семья"], order: 3, createdAt: new Date(), updatedAt: new Date(), ...over,
});

describe("неполные даты", () => {
    it("различает полную дату, год и день с месяцем; не подставляет неизвестные части", () => {
        for (const value of ["1950", "--02-29", "2024-02-29", "0001-01-01"]) assert.equal(personalDate(value), value);
        for (const value of ["0000", "--02-30", "2025-02-29", "--13-01", "195", "1950-00-10", "2026-01", "неизвестно"]) assert.equal(personalDate(value), null);
        assert.deepEqual(dateParts("1950"), { year: 1950, month: null, day: null });
        assert.deepEqual(dateParts("--04-03"), { year: null, month: 4, day: 3 });
        assert.equal(fullDate("--04-03"), null);
    });
    it("понимает неполные даты при вводе списком", () => {
        assert.equal(parseLine("Николай, р.1950").person?.born, "1950");
        assert.equal(parseLine("Николай, †12.03").person?.died, "--03-12");
        assert.equal(parseLine("Мария, кр.29.02").person?.baptized, "--02-29");
    });
    it("год сам по себе не создаёт напоминаний; без года не вычисляет возраст", () => {
        assert.equal(upcoming([person({ born: "1950" })], "2026-04-01", 10).length, 0);
        const events = upcoming([person({ born: "--04-03" })], "2026-04-01", 10);
        assert.equal(events.length, 1); assert.equal(events[0].date, "2026-04-03"); assert.equal(events[0].years, undefined);
    });
    it("без года кончины создаёт только ежегодный день памяти, без 3/9/40 дней", () => {
        const events = upcoming([person({ kind: "departed", died: "--04-03" })], "2026-04-01", 10).filter(e => e.personId);
        assert.deepEqual(events.map(e => e.kind), ["anniversary"]);
        assert.equal(events[0].years, undefined);
        assert.equal(memorialDays("--04-03"), null);
        assert.equal(memorialDays("1950"), null);
    });
    it("сохраняет неполные даты и срок пометы в копии; принимает прежний формат", () => {
        const p = person({ born: "1950", baptized: "--04-03", rank: "bolyashchiy", rankUntil: "2026-11-20" });
        const backup = makeBackup([p]);
        assert.equal(backup.version, 2);
        assert.deepEqual(parseBackup(backup), backup);
        assert.equal(parseBackup({ ...makeBackup([person()]), version: 1 }).persons[0].name, "Александр");
        assert.equal(planRestore([p], backup.persons).additions.length, 0);
    });
});

describe("временные пометы", () => {
    it("действуют до конца указанного дня, не стираются из карточки", () => {
        const p = person({ rank: "bolyashchiy", rankUntil: "2026-11-12" });
        assert.equal(effectiveRank(p, "2026-11-12"), "bolyashchiy");
        assert.equal(effectiveRank(p, "2026-11-13"), null);
        assert.equal(expiredRank(p, "2026-11-13"), true);
        assert.equal(p.rank, "bolyashchiy");
        assert.equal(effectiveRank({ rank: "ierey", rankUntil: "2000-01-01" }), "ierey");
        assert.equal(effectiveRank({ rank: "puteshestvuyushchiy" }), "puteshestvuyushchiy");
    });
    it("просроченная помета не попадает в новую записку", () => {
        assert.equal(snapshot(person({ rank: "bolyashchiy", rankUntil: "2000-01-01" })).rank, null);
    });
});

describe("подсказки о дублях", () => {
    it("находит повторяющиеся имена в книге из 10 000 записей без попарного сравнения", () => {
        const persons = Array.from({ length: 10000 }, (_, i) => person({ id: String(i), name: i % 2 ? "Николай" : "Мария" }));
        assert.equal(personsWithDuplicates(persons).length, 10000);
        const unique = person({ name: "Юрий", churchName: "Юрий" });
        assert.deepEqual(personsWithDuplicates([unique]), []);
    });
    it("сопоставляет мирское и церковное имя, учитывает ударения, исключает себя", () => {
        const a = person({ name: "Юрий", churchName: "Георгий" });
        const b = person({ id: "bbbbbbbbbbbbbbbbbbbbbbbb", name: "Гео́ргий", signature: "Петров", kind: "departed" });
        const c = person({ id: "cccccccccccccccccccccccc", name: "Николай" });
        assert.deepEqual(duplicateCandidates(a, [a, b, c]), [b]);
        assert.deepEqual(duplicateCandidates({ name: "", churchName: null }, [a, b]), []);
        assert.equal(a.signature, "Иванов"); assert.equal(b.signature, "Петров");
    });
});

const fakeStore = () => {
    const docs = [ { ...person({ rank: "bolyashchiy", rankUntil: "2026-12-01", born: "--04-03" }), _id: new ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa") },
        { ...person({ userId: "other", id: "bbbbbbbbbbbbbbbbbbbbbbbb" }), _id: new ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb") } ] as any[];
    const matches = (doc: any, filter: any) => Object.entries(filter).every(([key, value]: any) => key === "_id" ? String(doc._id) === String(value)
        : key === "deletedAt" ? (value === null ? doc.deletedAt == null : doc.deletedAt instanceof Date) : doc[key] === value);
    const store = {
        async updateOne(filter: any, update: any) {
            const doc = docs.find(d => matches(d, filter));
            if (!doc) return { modifiedCount: 0 };
            Object.assign(doc, update.$set); for (const key of Object.keys(update.$unset ?? {})) delete doc[key];
            return { modifiedCount: 1 };
        },
        async findOne(filter: any) { return docs.filter(d => matches(d, filter)).sort((a,b) => b.order-a.order)[0] ?? null; },
        async countDocuments(filter: any) { return docs.filter(d => matches(d, filter)).length; },
    } as unknown as TrashStore;
    return { store, docs };
};
describe("корзина", () => {
    it("удаляет обратимо и восстанавливает все сведения; повторное восстановление не создаёт копию", async () => {
        const { store, docs } = fakeStore();
        const original = { ...docs[0] };
        assert.ok(await moveToTrash(store, "owner", String(original._id)));
        assert.ok(docs[0].deletedAt instanceof Date);
        assert.equal(await moveToTrash(store, "owner", String(original._id)), false);
        assert.ok(await recoverFromTrash(store, "owner", String(original._id), 500));
        assert.equal(docs[0].deletedAt, undefined);
        for (const key of ["signature", "born", "rank", "rankUntil", "groups", "createdAt"]) assert.deepEqual(docs[0][key], original[key]);
        assert.equal(await recoverFromTrash(store, "owner", String(original._id), 500), false);
        assert.equal(docs.length, 2);
    });
    it("не позволяет удалить или восстановить чужую запись", async () => {
        const { store, docs } = fakeStore();
        assert.equal(await moveToTrash(store, "owner", String(docs[1]._id)), false);
        await moveToTrash(store, "other", String(docs[1]._id));
        assert.equal(await recoverFromTrash(store, "owner", String(docs[1]._id), 500), false);
        assert.ok(docs[1].deletedAt);
        assert.equal(await moveToTrash(store, "owner", "invalid"), false);
    });
    it("при превышении лимита оставляет запись в корзине", async () => {
        const { store, docs } = fakeStore();
        await moveToTrash(store, "owner", String(docs[0]._id));
        await assert.rejects(recoverFromTrash(store, "owner", String(docs[0]._id), 0), TrashLimitError);
        assert.ok(docs[0].deletedAt);
    });
});
