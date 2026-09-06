import test from "node:test";
import assert from "node:assert/strict";
import { convertWithAnswers, toPlainText, wordsToLookUp, type CslAnswer } from "@/lib/cslav/convert";

const answer = (word: string, parts: Partial<CslAnswer> = {}): CslAnswer => ({
    word, known: true, agree: null, corpus: [], lexicon: [], bible: [], titlo: [], ...parts,
});

const answers = (...list: Array<[string, CslAnswer]>) => new Map(list);

test("текст собирается обратно без потерь", () => {
    const text = "Господи, воззвах\nк тебе!";
    const got = convertWithAnswers(text, new Map(), { rule: false });
    assert.equal(toPlainText(got.tokens), text);
});

test("одно засвидетельствованное написание подставляется без спроса", () => {
    const got = convertWithAnswers("воззвах", answers(
        ["воззвах", answer("воззвах", { corpus: [{ w: "воззва́хъ", n: 3, d: 3 }] })],
    ));
    assert.equal(toPlainText(got.tokens), "воззва́хъ");
    assert.equal(got.byDictionary, 1);
    assert.equal(got.tokens[0].source, "corpus");
});

test("падежные пары остаются спором, даже когда одно написание втрое частотнее", () => {
    // Словарь знает три падежа, и подтверждать лидера чужим падежом нельзя:
    // «тебѣ» дательный, «тебе» винительный, «тебє» родительный.
    const got = convertWithAnswers("тебе", answers(["тебе", answer("тебе", {
        corpus: [{ w: "тебѣ̀", n: 550, d: 127 }, { w: "тебѐ", n: 258, d: 80 }],
        lexicon: [
            { w: "тебе́", l: "ты́", p: "acc" },
            { w: "тебє́", l: "ты́", p: "gen" },
            { w: "тебѣ́", l: "ты́", p: "dat/loc" },
        ],
    })]));
    assert.equal(got.ambiguous, 1);
    const variants = got.tokens[0].variants!;
    assert.equal(variants[0].applied, "тебѣ̀");
    assert.equal(variants[0].count, 550);
    assert.equal(variants[0].texts, 127);
    // Пометы словаря доезжают до читателя: без них спор не разрешить.
    assert.ok(variants.some((v) => v.properties === "dat/loc"));
    assert.ok(variants.some((v) => v.properties === "gen"));
});

test("явное превосходство снимает спор", () => {
    const got = convertWithAnswers("яко", answers(["яко", answer("яко", {
        corpus: [{ w: "ꙗ҆́кѡ", n: 4303, d: 245 }, { w: "ꙗ҆́ко", n: 501, d: 9 }],
    })]));
    assert.equal(got.byDictionary, 1);
    assert.equal(got.ambiguous, 0);
});

test("словарь ставит звательце, которого у него нет", () => {
    // В словаре нет ни одного звательца из 148 204 форм, а в книгах оно стоит
    // у 94,9% слов с начальной гласной. Словарное написание доводится правилом,
    // и это отмечается в токене.
    const got = convertWithAnswers("услыши", answers(["услыши", answer("услыши", {
        lexicon: [{ w: "ᲂуслы́ши", l: "услы́шати", p: "imper,sg,2p/3p" }],
    })]));
    assert.equal(toPlainText(got.tokens), "ᲂу҆слы́ши");
    assert.deepEqual(got.tokens[0].rules, ["звательце"]);
});

test("незнакомое слово уходит правилу и помечается", () => {
    const got = convertWithAnswers("возопих", new Map());
    assert.equal(got.byRule, 1);
    assert.equal(toPlainText(got.tokens), "возопихъ");
    assert.deepEqual(got.tokens[0].rules, ["ер"]);
});

test("без правила незнакомое слово остаётся как было", () => {
    const got = convertWithAnswers("возопих", new Map(), { rule: false });
    assert.equal(got.untouched, 1);
    assert.equal(toPlainText(got.tokens), "возопих");
    assert.match(got.tokens[0].why!, /не знает/);
});

test("уже церковнославянское и киноварь не трогаются", () => {
    const got = convertWithAnswers("Гдⷭ҇и {k|на глас 6} тебѣ̀", new Map());
    assert.equal(got.byDictionary + got.byRule + got.ambiguous, 0);
    assert.equal(toPlainText(got.tokens), "Гдⷭ҇и {k|на глас 6} тебѣ̀");
    assert.ok(got.tokens.some((t) => t.why === "киноварь"));
    assert.ok(got.tokens.some((t) => t.why === "уже церковнославянское написание"));
});

test("спрашиваем у указателя только то, что имеет смысл спрашивать", () => {
    const keys = wordsToLookUp("Господи, тебѣ̀ {k|киноварь} воззвах");
    assert.deepEqual(keys.sort(), ["воззвах", "господи"]);
});

test("выбор человека попадает в готовый текст", () => {
    const got = convertWithAnswers("тебе", answers(["тебе", answer("тебе", {
        corpus: [{ w: "тебѣ̀", n: 550, d: 127 }, { w: "тебѐ", n: 258, d: 80 }],
        lexicon: [{ w: "тебе́", l: "ты́", p: "acc" }, { w: "тебѣ́", l: "ты́", p: "dat/loc" }],
    })]));
    const chosen = { 0: got.tokens[0].variants![1].applied };
    assert.equal(toPlainText(got.tokens, chosen), "тебѐ");
});

test("единичное написание не предлагается: это описка, а не разночтение", () => {
    // «тѣбѣ» встречается в собрании дважды при 550 у «тебѣ̀».
    const got = convertWithAnswers("тебе", answers(["тебе", answer("тебе", {
        corpus: [{ w: "тебѣ̀", n: 550, d: 127 }, { w: "тебѐ", n: 258, d: 80 }, { w: "тѣбѣ", n: 2, d: 2 }],
        lexicon: [{ w: "тебе́", l: "ты́", p: "acc" }, { w: "тебѣ́", l: "ты́", p: "dat/loc" }],
    })]));
    const spellings = got.tokens[0].variants!.map((v) => v.spelling);
    assert.ok(!spellings.includes("тѣбѣ"), spellings.join(", "));
});

test("предлог решает спор о написании", () => {
    const tebe = answer("тебе", {
        corpus: [{ w: "тебѣ̀", n: 550, d: 127 }, { w: "тебѐ", n: 258, d: 80 }],
        lexicon: [
            { w: "тебе́", l: "ты́", p: "acc" },
            { w: "тебє́", l: "ты́", p: "gen" },
            { w: "тебѣ́", l: "ты́", p: "dat/loc" },
        ],
    });
    const map = answers(["тебе", tebe]);

    const dative = convertWithAnswers("к тебе", map);
    assert.equal(dative.byGrammar, 1);
    // Сам предлог тоже переводится правилом: «к» → «къ».
    assert.equal(toPlainText(dative.tokens), "къ тебѣ̀");
    assert.match(dative.tokens.find((t) => t.kind === "byGrammar")!.why!, /дательного/);

    const genitive = convertWithAnswers("от тебе", map);
    assert.equal(toPlainText(genitive.tokens), "ѿ тебє́");

    // Предлог с двумя падежами сужает, но выбор оставляет человеку.
    const both = convertWithAnswers("на тебе", map);
    assert.equal(both.ambiguous, 1);
    assert.match(both.tokens.find((t) => t.kind === "ambiguous")!.why!, /винительного или местного/);

    // Без предлога — спор как был.
    assert.equal(convertWithAnswers("тебе", map).ambiguous, 1);
});

test("управление рвётся знаком препинания", () => {
    const map = answers(["тебе", answer("тебе", {
        corpus: [{ w: "тебѣ̀", n: 550, d: 127 }, { w: "тебѐ", n: 258, d: 80 }],
        lexicon: [{ w: "тебе́", l: "ты́", p: "acc" }, { w: "тебѣ́", l: "ты́", p: "dat/loc" }],
    })]);
    // «к, тебе» — это уже не управление, а два места предложения.
    assert.equal(convertWithAnswers("к, тебе", map).byGrammar, 0);
});
