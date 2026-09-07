import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { expiresAt, NoteError, snapshot, spanOf, validateNote, type NoteName } from "./note";
import { checkDomain, slugOf } from "./claim";

const name = (over: Partial<NoteName> = {}): NoteName => ({
    name: "Николай", churchName: null, slavonic: null, slavonicSource: null,
    kind: "living", rank: null, sex: null, ...over,
});

describe("снимок имени", () => {
    it("кладёт имя и склонение в записку, а не ссылку на помянник", () => {
        const shot = snapshot(
            { name: "Юрий", churchName: "Георгий", kind: "living", rank: "voin", sex: "m" },
            { genitive: "геѡ́ргіа", source: "lexicon" });
        assert.deepEqual(shot, {
            name: "Юрий", churchName: "Георгий", slavonic: "геѡ́ргіа",
            slavonicSource: "lexicon", kind: "living", rank: "voin", sex: "m",
        });
    });

    it("без славянской формы записку не рушит", () => {
        assert.equal(snapshot({ name: "Радмила", kind: "departed" }).slavonic, null);
    });
});

describe("проверка записки", () => {
    it("панихиду о живых не принимает и называет, кого именно", () => {
        assert.throws(
            () => validateNote("panihida", [name({ kind: "departed" }), name({ name: "Анна" })]),
            (e: Error) => e instanceof NoteError && /Анна/.test(e.message));
    });

    it("молебен об усопших не принимает", () => {
        assert.throws(() => validateNote("moleben", [name({ kind: "departed" })]), NoteError);
    });

    it("обедню и псалтирь принимает о тех и о других", () => {
        const both = [name(), name({ name: "Иоанн", kind: "departed" })];
        assert.equal(validateNote("proskomidia", both).length, 2);
        assert.equal(validateNote("psaltir", both).length, 2);
    });

    it("пустую записку не принимает", () => {
        assert.throws(() => validateNote("proskomidia", []), NoteError);
        assert.throws(() => validateNote("proskomidia", [name({ name: "" })]), NoteError);
    });

    it("не принимает больше двадцати имён", () => {
        const many = Array.from({ length: 21 }, () => name());
        assert.throws(() => validateNote("proskomidia", many), NoteError);
    });

    it("выдуманного поминовения не знает", () => {
        assert.throws(() => validateNote("obedня-с-доставкой", [name()]), NoteError);
    });
});

describe("срок длящегося поминовения", () => {
    it("сорокоуст — сорок дней, считая день подачи", () => {
        assert.deepEqual(spanOf("sorokoust", new Date("2026-03-01T10:00:00Z")),
                         { from: "2026-03-01", to: "2026-04-09" });
    });

    it("у разового срока нет", () => {
        assert.equal(spanOf("proskomidia", new Date()), null);
        assert.equal(spanOf("panihida", new Date()), null);
    });

    it("год — триста шестьдесят пять дней", () => {
        assert.equal(spanOf("god", new Date("2026-01-01T00:00:00Z"))?.to, "2026-12-31");
    });
});

describe("когда записку стирать", () => {
    const at = (d: string) => new Date(`${d}T12:00:00Z`);

    it("прочитанную — через тридцать дней после прочтения", () => {
        assert.equal(
            expiresAt({ createdAt: at("2026-03-01"), readAt: at("2026-03-05") })
                .toISOString().slice(0, 10), "2026-04-04");
    });

    it("непрочитанную — через три месяца: чужие имена не копим", () => {
        assert.equal(
            expiresAt({ createdAt: at("2026-03-01") }).toISOString().slice(0, 10),
            "2026-05-30");
    });

    it("длящуюся — через тридцать дней после конца срока, а не после прочтения", () => {
        assert.equal(
            expiresAt({ createdAt: at("2026-03-01"), readAt: at("2026-03-02"),
                        span: { to: "2026-04-09" } }).toISOString().slice(0, 10),
            "2026-05-09");
    });
});

describe("сличение домена почты и страницы епархии", () => {
    it("тот же домен — точное совпадение", () => {
        assert.equal(checkDomain("https://mospat.ru/clergy/", "o.nikolay@mospat.ru").match, "exact");
        assert.equal(checkDomain("https://www.mospat.ru/", "a@mospat.ru").match, "exact");
    });

    it("поддомен считает тем же доменом, но говорит об этом", () => {
        const check = checkDomain("https://clergy.mospat.ru/x", "a@mail.mospat.ru");
        assert.equal(check.match, "subdomain");
        assert.match(check.note, /разные поддомены/);
    });

    it("чужой домен не отвергает, а называет поводом спросить", () => {
        const check = checkDomain("https://mospat.ru/", "batyushka@gmail.com");
        assert.equal(check.match, "different");
        assert.match(check.note, /повод спросить/);
    });

    it("неразобранное называет неразобранным, а не совпадением", () => {
        assert.equal(checkDomain("", "a@mospat.ru").match, "unknown");
        assert.equal(checkDomain("https://mospat.ru", "не почта").match, "unknown");
    });
});

describe("адрес открытой страницы", () => {
    it("переводит сан и имя в латиницу", () => {
        assert.equal(slugOf("Иерей Николай Петров"), "ierey-nikolay-petrov");
        assert.equal(slugOf("Протоиерей Ёлкин"), "protoierey-elkin");
    });

    it("пустое имя не даёт пустого адреса", () => {
        assert.equal(slugOf(""), "svyaschennik");
        assert.equal(slugOf("!!!"), "svyaschennik");
    });
});
