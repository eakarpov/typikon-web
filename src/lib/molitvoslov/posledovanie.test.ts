import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPosledovanieRows, type PosledovanieRowInput } from "@/lib/molitvoslov/posledovanie";
import { canRedistribute } from "@/lib/molitvoslov/rights";

// Сборка строк последования из вхождений: порядок печати, рубрики указаниями,
// женский вариант строки.

const row = (over: Partial<PosledovanieRowInput> = {}): PosledovanieRowInput => ({
    id: "t1",
    seq: 1,
    label: null,
    lead: null,
    repeatCount: null,
    poklon: null,
    kind: "text",
    text: "Текст.",
    textF: null,
    ...over,
});

test("строки идут в порядке печати, независимо от входа", () => {
    const rows = buildPosledovanieRows([
        row({ id: "b", seq: 3, text: "Третья." }),
        row({ id: "a", seq: 1, text: "Первая." }),
        row({ id: "c", seq: 2, text: "Вторая." }),
    ], "m");
    assert.deepEqual(rows.map(r => r.text), ["Первая.", "Вторая.", "Третья."]);
});

test("поля места переносятся как есть", () => {
    const [built] = buildPosledovanieRows([
        row({
            seq: 1, label: "Молитва мытаря", lead: "Возглас", repeatCount: 3,
            poklon: "Поклон", text: "Бо́же, ми́лостив бу́ди мне гре́шному.",
        }),
    ], "m");
    assert.deepEqual(built, {
        label: "Молитва мытаря",
        lead: "Возглас",
        repeatCount: 3,
        poklon: "Поклон",
        note: null,
        text: "Бо́же, ми́лостив бу́ди мне гре́шному.",
    });
});

test("рубрика — указание, а не текст", () => {
    const [built] = buildPosledovanieRows([
        row({ kind: "rubric", text: "Прочесть трижды, с поклоном." }),
    ], "m");
    assert.equal(built.note, "Прочесть трижды, с поклоном.");
    assert.equal(built.text, null);
});

test("женский вариант берётся из text_f, когда он есть", () => {
    const [built] = buildPosledovanieRows([
        row({ text: "поми́луй мя́, гре́шнаго.", textF: "поми́луй мя́, гре́шную." }),
    ], "f");
    assert.equal(built.text, "поми́луй мя́, гре́шную.");

    const [male] = buildPosledovanieRows([
        row({ text: "поми́луй мя́, гре́шнаго.", textF: "поми́луй мя́, гре́шную." }),
    ], "m");
    assert.equal(male.text, "поми́луй мя́, гре́шнаго.");
});

test("женского варианта нет — оба рода читают общий текст", () => {
    const [built] = buildPosledovanieRows([row({ text: "Верую во еди́наго Бо́га Отца́." })], "f");
    assert.equal(built.text, "Верую во еди́наго Бо́га Отца́.");
});

// --- Права ------------------------------------------------------------------

test("слои молитвослова и служебника раздаются, английский слой — нет", () => {
    assert.equal(canRedistribute("molitvoslov", "cu_gr"), true);
    assert.equal(canRedistribute("molitvoslov", "cu"), true);
    assert.equal(canRedistribute("molitvoslov", "en"), false);
    assert.equal(canRedistribute("sluzhebnik", "cu_gr"), true);
    assert.equal(canRedistribute("chasoslov", "cu_gr"), true);
    assert.equal(canRedistribute("rules", "cu_gr"), true);
});

test("издание вне карты прав не раздаётся", () => {
    assert.equal(canRedistribute("patriarchia", "cu_gr"), false);
    assert.equal(canRedistribute(null, "cu_gr"), false);
    assert.equal(canRedistribute("molitvoslov", null), false);
});
