import test from "node:test";
import assert from "node:assert/strict";
import { foldPua, hasPua, PUA_TABLE, PUA_BY_CODE } from "@/lib/csEncoding/pua";
import { normalizeChurchSlavonic } from "@/utils/churchSlavonic";

test("сочетания и выносные сводятся без спроса", () => {
    // Те же знаки, записанные иначе: терять при таком сведении нечего.
    assert.equal(foldPua("и\uE001").text, "и҆́".normalize("NFC"));
    assert.equal(foldPua("г\uF4ED").text, "гⷭ҇".normalize("NFC"));
    assert.equal(foldPua("\u{F0023}").text, "ⷣ‍ꙵ");
});

test("варианты начертаний остаются, пока их не спросят", () => {
    // «Ять короткая» и «ѣ» отличаются рисунком буквы, и для воспроизведения
    // издания это различие значимо.
    assert.equal(foldPua("мнѡѕ\uE0EC").text, "мнѡѕ\uE0EC");
    assert.equal(foldPua("мнѡѕ\uE0EC", { letters: true }).text, "мнѡѕѣ");
});

test("отчёт называет и сведённое, и оставленное", () => {
    const got = foldPua("и\uE001 гдⷭ\uE086 мнѡѕ\uE0EC");
    assert.equal(got.folded[0xe001], 1);
    assert.equal(got.kept[0xe086], 1);     // соответствия нет
    assert.equal(got.kept[0xe0ec], 1);     // вариант начертания, не спрошен
    assert.equal(got.folded[0xe0ec], undefined);
});

test("незнакомый частный код не трогается", () => {
    // Соглашение покрывает не всю область, и подставлять наугад нельзя.
    assert.equal(foldPua("а\uE500б").text, "а\uE500б");
    assert.equal(foldPua("а\uE500б").kept[0xe500], 1);
});

test("после сведения слово находится по гражданскому запросу", () => {
    // Ради этого всё и затевалось: «ять короткая» не сводилась ни к ѣ, ни к е,
    // и слово не искалось.
    const withPua = "мнѡѕ\uE0ECⷨ";
    assert.match(normalizeChurchSlavonic(withPua), /\uE0EC/);
    const folded = foldPua(withPua, { letters: true }).text;
    // Выносная ⷨ при сведении отбрасывается: она написана над строкой и в
    // линейный порядок не встаёт.
    assert.equal(normalizeChurchSlavonic(folded), "мнозе");
});

test("частная область распознаётся во всех трёх плоскостях", () => {
    assert.equal(hasPua("обычный текст"), false);
    assert.equal(hasPua("а\uE001"), true);
    assert.equal(hasPua("а\u{F0023}"), true);
    assert.equal(hasPua("а\u{100001}"), true);
});

test("таблица не расходится сама с собой", () => {
    for (const entry of PUA_TABLE) {
        assert.equal(PUA_BY_CODE[entry.cp], entry);
        assert.ok(entry.evidence.length > 10, `у U+${entry.cp.toString(16)} нет обоснования`);
        // Соответствие обязано быть у всего, кроме прямо объявленного неизвестным.
        assert.equal(entry.kind === "unknown", entry.to === undefined,
            `U+${entry.cp.toString(16)}: разряд и наличие соответствия не сходятся`);
        if (entry.to) {
            assert.equal(entry.to, entry.to.normalize("NFC"), `U+${entry.cp.toString(16)}: запись не в NFC`);
        }
    }
});
