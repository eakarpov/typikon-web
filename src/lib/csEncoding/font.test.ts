import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readFont, type FontInfo } from "@/lib/csEncoding/font";
import { coverageOf, missingFor, puaOf, verdictOf } from "@/lib/csEncoding/fontReport";

// Проверяем на шрифтах, которые лежат в самом хранилище: Мономах — наш
// церковнославянский, Old Standard — обычный шрифт с засечками. Второй нужен не
// меньше первого: разбор должен отличать одно от другого.
const load = (name: string) => {
    const buf = fs.readFileSync(path.join(process.cwd(), "public/fonts", name));
    return readFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
};

const monomakh = load("Monomakh-Regular.ttf");
const oldStandard = load("OldStandard-Regular.otf");

test("шрифт читается: имя, начертание, число знаков", () => {
    assert.equal(monomakh.names.family, "Monomakh");
    assert.equal(monomakh.format, "truetype");
    assert.equal(oldStandard.format, "cff");
    assert.ok(monomakh.codepoints.size > 500, `знаков всего ${monomakh.codepoints.size}`);
    assert.ok(monomakh.glyphCount >= monomakh.codepoints.size / 2);
});

test("таблица соответствий распознаётся как юникодная", () => {
    assert.equal(monomakh.cmap?.legacy, false);
    assert.match(monomakh.cmap!.label, /юникод/);
});

test("покрытие считается по разрядам", () => {
    const cover = coverageOf(monomakh);
    const superscripts = cover.find((c) => c.group.name === "Выносные буквы")!;
    assert.equal(superscripts.missing.length, 0, "Мономах покрывает весь блок выносных");

    const other = coverageOf(oldStandard).find((c) => c.group.name === "Уставные начертания")!;
    assert.equal(other.have, 0, "Old Standard уставных начертаний не содержит");
});

test("вывод о шрифте: церковнославянский, общий, дореформенный", () => {
    // Оба здешних шрифта покрывают весь блок выносных, и Old Standard в этом
    // смысле тоже церковнославянский — разнятся они уставными начертаниями,
    // которых у него нет вовсе (см. проверку покрытия выше).
    assert.equal(verdictOf(monomakh).kind, "unicode-cs");
    assert.equal(verdictOf(oldStandard).kind, "unicode-cs");
    assert.ok(verdictOf(monomakh).why.some((w) => /выносных букв: 32/.test(w)));

    // Прочие случаи проверяем на собранных вручную описаниях: держать в
    // хранилище чужие шрифты ради теста незачем.
    const make = (codes: number[], extra: Partial<FontInfo> = {}): FontInfo => ({
        format: "truetype",
        names: {},
        cmap: { platform: 3, encoding: 1, format: 4, label: "юникод, основная плоскость", legacy: false },
        cmaps: [],
        codepoints: new Map(codes.map((cp) => [cp, 1])),
        glyphNames: new Map(),
        glyphCount: codes.length,
        tables: ["GPOS", "cmap", "glyf", "head", "name"],
        widths: new Map(),
        layout: { gpos: true, markToBase: true, markToMark: true, gsub: true, features: ["mark"] },
        ...extra,
    });

    // Обычный шрифт: кириллица есть, выносных нет.
    const general = verdictOf(make([0x430, 0x431, 0x432]));
    assert.equal(general.kind, "unicode-general");

    // Латинский шрифт: кириллицы нет вовсе — но это не делает его дореформенным.
    // На этом разбор однажды и ошибся, записав Source Sans Pro в дореформенные.
    const latin = verdictOf(make([0x41, 0x42, 0x61]));
    assert.equal(latin.kind, "unicode-general");
    assert.match(latin.title, /без кириллицы/);

    // Дореформенный: раскладка по байтам, юникодной кириллицы нет.
    const legacy = verdictOf(make([0x41, 0x42], {
        cmap: { platform: 3, encoding: 0, format: 4, label: "символьная раскладка Windows (байты в частной области)", legacy: true },
    }));
    assert.equal(legacy.kind, "legacy");
    assert.ok(legacy.warnings[0].includes("перекодировки"));
});

test("раскладка UCS опознаётся по совпадению примет", () => {
    // Шрифты Ирмология объявляют юникодную таблицу, но кладут в неё набор
    // кодовой страницы CP1251, а церковнославянские знаки ставят по местам
    // латиницы и цифр: «a» — это «а́», «x» — «ѯ», «9» — «ж҃». По таблице
    // соответствий это не видно, и опознаётся оно совпадением трёх примет.
    const ucs: FontInfo = {
        format: "truetype",
        names: { family: "Hirmos Ucs8" },
        cmap: { platform: 3, encoding: 1, format: 4, label: "юникод, основная плоскость", legacy: false },
        cmaps: [],
        // Набор CP1251: латиница, кириллица и типографские знаки — 224 кода.
        codepoints: new Map([...Array.from({ length: 95 }, (_, i) => [0x20 + i, 1] as [number, number]),
            ...Array.from({ length: 64 }, (_, i) => [0x410 + i, 1] as [number, number])]),
        glyphNames: new Map(),
        glyphCount: 224,
        tables: ["GPOS", "cmap", "glyf", "head", "kern", "name", "post"],
        widths: new Map(),
        layout: { gpos: true, markToBase: false, markToMark: false, gsub: false, features: [] },
    };
    const verdict = verdictOf(ucs);
    assert.equal(verdict.kind, "ucs-layout");
    assert.ok(verdict.why.some((w) => /kern/.test(w)), verdict.why.join(" | "));
    assert.ok(verdict.warnings[0].includes("перекодировать"));

    // Наши собственные шрифты под примету не подпадают: у них есть и знаки,
    // и привязка.
    assert.notEqual(verdictOf(monomakh).kind, "ucs-layout");
    assert.notEqual(verdictOf(oldStandard).kind, "ucs-layout");
});

test("полнота знаков ещё не делает шрифт пригодным", () => {
    // Без привязки знака к основе надстрочный встаёт отдельной литерой, и слово
    // рассыпается — при том что заполнителей на экране не появится.
    const crippled: FontInfo = {
        ...monomakh,
        layout: { ...monomakh.layout, markToBase: false, markToMark: false },
    };
    const verdict = verdictOf(crippled);
    assert.equal(verdict.kind, "unicode-cs");
    assert.ok(verdict.warnings.some((w) => /не прикрепляет надстрочные/.test(w)), verdict.warnings.join(" | "));
});

test("прикрепление надстрочных читается из GPOS", () => {
    // Без него надстрочный знак встаёт отдельной литерой, и слово рассыпается,
    // хотя заполнителей не появляется.
    assert.equal(monomakh.layout.markToBase, true);
    assert.equal(monomakh.layout.markToMark, true);
    assert.ok(monomakh.layout.features.includes("mark"));
});

test("недостающие знаки считаются по тексту", () => {
    const text = "Гдⷭ҇и, воззва́хъ къ тебѣ̀ · ᲅри";
    assert.deepEqual(missingFor(monomakh, text), []);

    const gaps = missingFor(oldStandard, text);
    assert.ok(gaps.length > 0, "Old Standard покрыть эту строку не может");
    // Называем не только код, но и знак: список кодов читателю бесполезен.
    assert.ok(gaps.some((g) => /выносная|уставн|т высокое|т трёхногое/.test(g.name)),
        gaps.map((g) => g.name).join(", "));
});

test("частная область разбирается по соглашению", () => {
    const { known, unknown } = puaOf(monomakh);
    assert.ok(known.length >= 10, `опознано ${known.length}`);
    assert.ok(known.some((e) => e.cp === 0xe001));
    // Соглашение шире нашей таблицы, и остальное честно числится неизвестным.
    assert.ok(unknown.length > 0);
});

test("не шрифт — внятный отказ, а не поломка", () => {
    const junk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]).buffer;
    assert.throws(() => readFont(junk), /не похоже на шрифт|подписи sfnt/i);
});
