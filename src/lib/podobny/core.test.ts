import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { foldHomoglyphs, isArtefactName, keySlug, mixedScript, podobenUnits, type PodobenRow } from "./core";

const row = (over: Partial<PodobenRow> = {}): PodobenRow => ({
    language: "cu_gr",
    podoben: "Гро́б Тво́й, Спа́се",
    podobenKey: null,
    tone: 1,
    groups: 1,
    items: 1,
    ...over,
});

describe("слияние написаний", () => {
    it("сводит четыре написания одного подобна в одну единицу", () => {
        const units = podobenUnits([
            row({ podoben: "Гро́б Тво́й, Спа́се", items: 79 }),
            row({ podoben: "Гро́б Тво́й Спа́се", items: 17 }),
            row({ podoben: "Гроб Твой, Спасе", items: 2 }),
            row({ podoben: "Гро́б Тво́й, Cпа́се", items: 1 }),   // латинская C
        ]);
        assert.equal(units.length, 1);
        assert.equal(units[0].items, 99);
        // Ни одно написание не пропало: страница подобна — ещё и указатель опечаток.
        assert.equal(units[0].spellings.length, 4);
    });

    it("не сводит разные подобны и разные языки", () => {
        const units = podobenUnits([
            row({ podoben: "Гро́б Тво́й, Спа́се" }),
            row({ podoben: "Небе́сных чино́в" }),
            // Греческое имя того же подобна без ключа свести не с чем: узнать
            // об этом из самих строк невозможно.
            row({ language: "grc", podoben: "Τὸν τάφον σου Σωτήρ" }),
        ]);
        assert.equal(units.length, 3);
    });

    it("сводит языки ключом издания", () => {
        const units = podobenUnits([
            row({ podoben: "До́ме Евфра́фов", podobenKey: "heAU.OikosTouEfratha", items: 827 }),
            row({ language: "grc", podoben: "Οἶκος τοῦ Ἐφραθᾶ", podobenKey: "heAU.OikosTouEfratha", items: 317 }),
        ]);
        assert.equal(units.length, 1);
        assert.equal(units[0].items, 1144);
        assert.deepEqual(units[0].names.map(n => n.language), ["cu_gr", "grc"]);
    });

    it("возвращает к ключу написание, которому книга ключа не поставила", () => {
        const units = podobenUnits([
            row({ podoben: "Я́ко до́бля в му́ченицех", podobenKey: "heAU.OsGennaion", items: 200 }),
            row({ podoben: "Яко добля в мученицех", podobenKey: null, items: 5 }),
        ]);
        assert.equal(units.length, 1);
        assert.equal(units[0].items, 205);
        assert.equal(units[0].spellings.find(s => s.byName)?.items, 5);
    });

    it("не зовёт «примкнувшим по имени» написание, у которого ключ где-то есть", () => {
        // Одно и то же написание книга подписывает ключом не везде; сказать о
        // нём «книга ключа не ставила» было бы неправдой.
        const units = podobenUnits([
            row({ podoben: "Я́ко до́бля", podobenKey: "heAU.OsGennaion", items: 200 }),
            row({ podoben: "Я́ко до́бля", podobenKey: null, items: 5 }),
        ]);
        assert.equal(units[0].spellings.length, 1);
        assert.equal(units[0].spellings[0].items, 205);
        assert.equal(units[0].spellings[0].byName, false);
    });

    it("спорное имя отдаёт большинству, а меньшинство оставляет видимым", () => {
        const units = podobenUnits([
            row({ language: "ro", podoben: "Ceea ce eşti bucuria", podobenKey: "heAU.TonOuranion", items: 96 }),
            row({ language: "ro", podoben: "Ceea ce eşti bucuria", podobenKey: "heAU.Paneffimoi", items: 5 }),
        ]);
        const big = units.find(u => u.agesKey === "heAU.TonOuranion");
        assert.equal(big?.items, 96);
        // Меньшинство не исчезает: у него свой ключ, значит и своя единица.
        assert.equal(units.length, 2);
    });
});

describe("пометка издания «Αὐτόμελον»", () => {
    it("узнаётся при любой расстановке ударений", () => {
        assert.equal(isArtefactName("Αὐτόμελον"), true);
        assert.equal(isArtefactName("Αυτόμελον"), true);
        assert.equal(isArtefactName("Οἶκος τοῦ Ἐφραθᾶ"), false);
    });

    it("не становится ни именем, ни адресом", () => {
        const units = podobenUnits([
            row({ language: "grc", podoben: "Οἶκος τοῦ Ἐφραθᾶ", podobenKey: "heAU.OikosTouEfratha", items: 100 }),
            row({ language: "grc", podoben: "Αὐτόμελον", podobenKey: "heAU.OikosTouEfratha", items: 6 }),
        ]);
        assert.equal(units.length, 1);
        assert.equal(units[0].names.length, 1);
        assert.equal(units[0].names[0].printed, "Οἶκος τοῦ Ἐφραθᾶ");
        assert.ok(!units[0].slug.includes("aftomelon"));
        // Строки не выброшены — они видимы отдельным написанием с пометкой.
        assert.equal(units[0].spellings.find(s => s.artefact)?.items, 6);
    });
});

describe("латиница в кириллическом имени", () => {
    it("складывается при слиянии", () => {
        assert.equal(foldHomoglyphs("Гро́б Тво́й, Cпа́се"), "Гро́б Тво́й, Спа́се");
        assert.equal(foldHomoglyphs("Kpacoте́ де́вства"), "Красоте́ де́вства");
    });

    it("не трогает имя, в котором кириллицы нет вовсе", () => {
        // Иначе румынское «Casa Eufratului» обратилось бы в кириллическую нелепицу.
        assert.equal(foldHomoglyphs("Casa Eufratului"), "Casa Eufratului");
        assert.equal(foldHomoglyphs("Οἶκος τοῦ Ἐφραθᾶ"), "Οἶκος τοῦ Ἐφραθᾶ");
    });

    it("помечается, а не заминается", () => {
        assert.equal(mixedScript("Гро́б Тво́й, Cпа́се"), true);
        assert.equal(mixedScript("Гро́б Тво́й, Спа́се"), false);
        assert.equal(mixedScript("Ὡς γενναῖον ἐν Μάρτυσι"), false);
    });
});

describe("адреса", () => {
    it("выводит адрес из ключа издания", () => {
        assert.equal(keySlug("heAU.OsGennaionEnMartysi"), "os-gennaion-en-martysi");
    });

    it("даёт греческому имени латинский адрес, а не пустоту", () => {
        // Общий транслитератор проекта знает одну кириллицу: без греческой
        // таблицы у греческих подобнов адрес схлопнулся бы в пустую строку.
        const units = podobenUnits([row({ language: "grc", podoben: "Τῶν οὐρανίων ταγμάτων" })]);
        assert.equal(units[0].slug, "ton-ouranion-tagmaton");
    });

    it("не зависит от порядка строк выборки", () => {
        // Адрес выводится, а не хранится, и одинаковость его от сборки к
        // сборке — единственное, на чём держатся ссылки.
        const rows = [
            row({ podoben: "Небе́сных чино́в", items: 235 }),
            row({ podoben: "До́ме Евфра́фов", items: 268 }),
            row({ podoben: "Я́ко до́бля", items: 244 }),
        ];
        const straight = podobenUnits(rows).map(u => `${u.unitId}=${u.slug}`).sort();
        const shuffled = podobenUnits([...rows].reverse()).map(u => `${u.unitId}=${u.slug}`).sort();
        assert.deepEqual(shuffled, straight);
    });
});

describe("глас", () => {
    it("берёт преобладающий, а отклонения оставляет на виду", () => {
        const units = podobenUnits([
            row({ podoben: "Я́ко до́бля", tone: 4, items: 251 }),
            row({ podoben: "Я́ко до́бля", tone: 8, items: 1 }),
            row({ podoben: "Я́ко до́бля", tone: 2, items: 1 }),
        ]);
        assert.equal(units[0].tone, 4);
        assert.deepEqual(units[0].toneOutliers.map(o => o.tone).sort(), [2, 8]);
    });
});
