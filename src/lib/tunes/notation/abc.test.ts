import { test } from "node:test";
import assert from "node:assert/strict";
import { fitTune } from "@/lib/tunes/apply";
import { parseChantText } from "@/lib/tunes/syllables";
import { countNotes, toAbc } from "@/lib/tunes/notation/abc";
import { toZnamenny } from "@/lib/tunes/notation/znamenny";
import { resolveIn, scoresOf } from "@/lib/tunes/resolve";

const TEXT = "Храм всесве́тел/ трисо́лнечныя зари́ сый,/ озаря́еши ду́ши/ "
    + "пита́ющихся/ словесы́ твои́ми, Васи́лие.";

const fittedFor = (traditionId: string, address: Parameters<typeof resolveIn>[1]) => {
    const found = resolveIn(traditionId, address);
    assert.ok(found);
    return { found, fitted: fitTune(found.tune, parseChantText(TEXT)) };
};

test("размера у распева нет: тактов ABC не расставляет", () => {
    const { found, fitted } = fittedFor("znamenny-maly", {
        tone: 2, podoben: "До́ме Евфра́фов", genre: "stichera",
    });
    const abc = toAbc(fitted, scoresOf(found.tune, "staff"));

    assert.match(abc, /^X:1$/m);
    assert.match(abc, /^M:none$/m);
    // Черта — конец колена, и колен в подобне ровно пять.
    assert.equal(abc.split("\n").filter(l => l.startsWith("w:")).length, 5);
});

test("подтекстовка связывает слоги слова дефисом, а слова — пробелом", () => {
    const { found, fitted } = fittedFor("znamenny-maly", {
        tone: 2, podoben: "До́ме Евфра́фов", genre: "stichera",
    });
    const abc = toAbc(fitted, scoresOf(found.tune, "staff"));
    const lyrics = abc.split("\n").filter(l => l.startsWith("w:"));

    assert.equal(lyrics[0], "w: Храм все-све́-тел |");
    // «хс» — две шумные, и слог они начинают вместе: правило деления
    // морфологии не знает и знать не обязано (см. splitWord).
    assert.equal(lyrics[3], "w: пи-та́-ю-щи-хся |");
});

test("нот в колене столько же, сколько слогов", () => {
    const { found, fitted } = fittedFor("znamenny-maly", {
        tone: 2, podoben: "До́ме Евфра́фов", genre: "stichera",
    });
    const abc = toAbc(fitted, scoresOf(found.tune, "staff")).split("\n");
    const notes = abc.filter(l => !l.startsWith("w:") && l.endsWith("|"));

    for (const [i, row] of notes.entries()) {
        const count = row.replace(" |", "").split(" ").length;
        assert.equal(count, fitted.colons[i].cells.length);
    }
});

test("партес идёт двумя станами, как его и печатает обиход", () => {
    const { found, fitted } = fittedFor("obihod-partes", {
        tone: 1, podoben: null, genre: "stichera",
    });
    const abc = toAbc(fitted, scoresOf(found.tune, "staff"));

    // Дискант с альтом на скрипичном, тенор с басом на басовом — фигурные
    // скобки объединяют станы, круглые ставят два голоса на один стан.
    assert.match(abc, /^%%score \{\(V1 V2\) \(V3 V4\)\}$/m);
    assert.match(abc, /^V:V1 clef=treble name="сопрано, альт"$/m);
    assert.match(abc, /^V:V3 clef=bass name="тенор, бас"$/m);
    // Подпись — при первом голосе стана: вторая затёрла бы первую.
    assert.match(abc, /^V:V2 clef=treble$/m);

    // Текст один на всех и встаёт МЕЖДУ станами: пять колен — пять строк
    // подтекстовки, а не двадцать под каждой партией.
    assert.equal(abc.split("\n").filter(l => l.startsWith("w:")).length, 5);
});

test("подтекстовку можно снять, оставив одну мелодию", () => {
    const { found, fitted } = fittedFor("obihod-partes", {
        tone: 1, podoben: null, genre: "stichera",
    });
    const abc = toAbc(fitted, scoresOf(found.tune, "staff"), { lyrics: false });
    assert.equal(abc.includes("w:"), false);
});

test("знамя повторяется на каждом слоге речитатива", () => {
    // Крюковая строка так и пишется: сколько слогов вычитывается, столько
    // крюков подряд и стоит.
    const { found, fitted } = fittedFor("znamenny-maly", {
        tone: 1, podoben: null, genre: "stichera",
    });
    const [score] = scoresOf(found.tune, "znamenny");
    const lines = toZnamenny(fitted, score);

    assert.equal(lines.length, 5);
    for (const [i, line] of lines.entries()) {
        assert.equal(line.cells.length, fitted.colons[i].cells.length);
        assert.ok(line.cells.every(c => c.neume.length > 0));
    }
    // Второе колено — восемь слогов на трёх шагах: шесть первых знамён равны.
    const recited = lines[1].cells.slice(0, 6).map(c => c.neume);
    assert.equal(new Set(recited).size, 1);
});

test("распев держит свой слог подчёркиваниями, а не утаскивает следующие", () => {
    // ABC кладёт слог НА НОТУ, а не на шаг напева. Без подчёркиваний шаг с
    // распевом из двух нот съедал бы следующий слог, и «Спа́се» под нотами
    // выходило «Спа-се-е» вместо «Спа-а-се» — съезжало всё после первого
    // распева в колене.
    const found = resolveIn("obihod-msk", { tone: 3, podoben: null, genre: "troparion" });
    assert.ok(found);
    const colons = parseChantText(found.tune.sample!.text);
    const abc = toAbc(fitTune(found.tune, colons), scoresOf(found.tune, "staff"));
    const lyrics = abc.split("\n").filter(l => l.startsWith("w:"));

    // «Да веселя́тся Небе́сная» — распев сидит на «бе́», и подчёркивание держит
    // слог на второй его ноте, а «сна» остаётся при своей.
    assert.equal(lyrics[0], "w: Да ве-се-ля́-тся Не-бе́ _-сна-я |");

    // Нот в строке и слогов вместе с подчёркиваниями — поровну.
    const rows = abc.split("\n");
    for (let i = 0; i < rows.length; i++) {
        if (!rows[i].startsWith("w:")) continue;
        const notes = rows[i - 1].replace(" |", "").split(" ").flatMap(n => countNotes(n)).reduce((a, b) => a + b, 0);
        const syllables = rows[i].slice(3).replace(" |", "").split(/[\s-]+/).filter(Boolean).length;
        assert.equal(syllables, notes, rows[i]);
    }
});
