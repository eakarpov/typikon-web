import test from "node:test";
import assert from "node:assert/strict";
import { markWithAnswers, toPlainText, wordsToLookUp, type Token } from "@/lib/accents/mark";
import type { AccentAnswer } from "@/lib/accents/core";

// Разметка обязана быть осторожной: она ставит знаки в чужой текст. Здесь собраны
// случаи, где неосторожная реализация портит написанное.

const OXIA = "́";
const VARIA = "̀";

interface Stress { vowel: number; count: number; mark?: string; spelling?: string }

/** Ответ словаря: сколько раз слово размечено на такой-то гласной и сколько без знака. */
const answer = (word: string, stresses: Stress[], plain = 0, source: "corpus" | "chants" = "corpus"): AccentAnswer => {
    const accented = stresses.reduce((sum, s) => sum + s.count, 0);
    const variants = stresses.map((s) => ({
        vowel: s.vowel,
        mark: s.mark ?? OXIA,
        markName: "оксия",
        spelling: s.spelling ?? word,
        count: s.count,
        share: accented ? s.count / accented : 0,
    }));

    return {
        word,
        known: true,
        agree: true,
        accentedShare: accented + plain ? accented / (accented + plain) : null,
        corpus: source === "corpus" ? variants : [],
        chants: source === "chants" ? variants : [],
        lexicon: [],
    };
};

const unknown = (word: string): AccentAnswer =>
    ({ word, known: false, agree: null, accentedShare: null, corpus: [], chants: [], lexicon: [] });

const mark = (text: string, answers: Record<string, AccentAnswer>, genre: "reading" | "chant" = "reading") =>
    markWithAnswers(text, new Map(Object.entries(answers)), genre);

const kinds = (tokens: Token[]) => tokens.filter((t) => t.kind !== "plain").map((t) => t.kind);

test("ставит знак там, где собрание отвечает однозначно", () => {
    const result = mark("рече отец", { рече: answer("рече", [{ vowel: 1, count: 900 }]) });

    assert.equal(toPlainText(result.tokens), `рече${OXIA} отец`);
    assert.equal(result.marked, 1);
});

test("текст собирается обратно без потерь, включая пробелы и знаки препинания", () => {
    const text = "  рече\n\nотец, — и паки: «рече».  ";
    const result = mark(text, {});
    assert.equal(toPlainText(result.tokens), text);
});

test("спорное слово остаётся без знака и отдаёт варианты", () => {
    const result = mark("на руку", {
        руку: answer("руку", [{ vowel: 0, count: 173 }, { vowel: 1, count: 138 }]),
    });

    assert.deepEqual(kinds(result.tokens), ["ambiguous"]);
    assert.equal(toPlainText(result.tokens), "на руку");

    const variants = result.tokens.find((t) => t.kind === "ambiguous")!.variants!;
    assert.deepEqual(variants.map((v) => v.applied), [`ру${OXIA}ку`, `руку${OXIA}`]);
});

test("оксия и вария на одной гласной — одно ударение, а не спор", () => {
    // «сотворѝ» и «сотвори́» различаются видом знака, а не местом ударения:
    // вария ставится в конце колона. Считать это разночтением нельзя.
    const result = mark("сотвори", {
        сотвори: answer("сотвори", [
            { vowel: 2, count: 1015, mark: VARIA },
            { vowel: 2, count: 948, mark: OXIA },
        ]),
    });

    assert.deepEqual(kinds(result.tokens), ["marked"]);
    // Знак — преобладающий у этой гласной.
    assert.equal(toPlainText(result.tokens), `сотвори${VARIA}`);
});

test("предлоги и частицы не трогаются", () => {
    // «же» размечено 4 раза из 29 тысяч — знак ему не положен.
    const result = mark("отец же рече", {
        же: answer("же", [{ vowel: 0, count: 4 }], 28956),
        отец: answer("отец", [{ vowel: 1, count: 900 }]),
        рече: answer("рече", [{ vowel: 1, count: 900 }]),
    });

    assert.equal(toPlainText(result.tokens), `оте${OXIA}ц же рече${OXIA}`);
});

test("уже размеченное слово не трогается", () => {
    const text = `глаго${OXIA}лет`;
    const result = mark(text, {});
    assert.equal(toPlainText(result.tokens), text);
    assert.equal(result.expected, 0);
});

test("слова под титлом не трогаются: это сокращения и числа", () => {
    const text = "бж҃їѧ к҃є";
    const result = mark(text, {});
    assert.equal(toPlainText(result.tokens), text);
    assert.deepEqual(kinds(result.tokens), []);
});

test("киноварь не трогается: уставные пометы в книгах не размечают", () => {
    const result = mark("рече {k|аще есть рече} рече", {
        рече: answer("рече", [{ vowel: 1, count: 900 }]),
        аще: answer("аще", [{ vowel: 0, count: 900 }]),
        есть: answer("есть", [{ vowel: 0, count: 900 }]),
    });

    assert.equal(toPlainText(result.tokens), `рече${OXIA} {k|аще есть рече} рече${OXIA}`);
});

test("неизвестное многосложное слово помечается, односложное — нет", () => {
    const result = mark("Русская гмъ", { Русская: unknown("Русская"), гмъ: unknown("гмъ") });
    assert.equal(result.unknown, 1);
    assert.equal(toPlainText(result.tokens), "Русская гмъ");
});

test("жанр меняет ответ там, где книги и песнопения расходятся", () => {
    const answers = {
        спасе: {
            ...answer("спасе", [{ vowel: 1, count: 500 }]),
            chants: answer("спасе", [{ vowel: 0, count: 2024 }], 0, "chants").chants,
        },
    };

    assert.equal(toPlainText(mark("спасе", answers, "reading").tokens), `спасе${OXIA}`);
    assert.equal(toPlainText(mark("спасе", answers, "chant").tokens), `спа${OXIA}се`);
});

test("выбор в спорном месте подставляется в текст", () => {
    const result = mark("на руку", {
        руку: answer("руку", [{ vowel: 0, count: 173 }, { vowel: 1, count: 138 }]),
    });

    const index = result.tokens.findIndex((t) => t.kind === "ambiguous");
    assert.equal(toPlainText(result.tokens, { [index]: `руку${OXIA}` }), `на руку${OXIA}`);
});

test("спрашиваем словарь только о том, что можем изменить", () => {
    assert.deepEqual(wordsToLookUp(`рече бж҃їѧ въ глаго${OXIA}лет {k|аще}`), ["рече"]);
});
