import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { CORRECTIONS, replaceNormalized, toPolytonic } from "./fix-swete-typos";

// Правки меняют текст Писания поштучно и вручную. Проверяется, что каждая
// описана полно и что поиск не спотыкается о запись греческого разными знаками.

describe("список правок", () => {
    it("каждая правка что-то меняет и говорит почему", () => {
        CORRECTIONS.forEach((fix) => {
            assert.ok(fix.canonRef.includes("."), `${fix.canonRef}: не адрес стиха`);
            assert.notEqual(fix.from, fix.to, `${fix.canonRef}: правка ничего не меняет`);
            assert.ok(fix.why.length > 20, `${fix.canonRef}: не объяснено`);
        });
    });

    it("не правит один адрес дважды", () => {
        const refs = CORRECTIONS.map((fix) => fix.canonRef);
        assert.equal(new Set(refs).size, refs.length);
    });
});

describe("поиск с оглядкой на нормализацию", () => {
    // В базе греческий записан знаками Greek Extended: «ά» — U+1F71 (оксия).
    // В исходнике набирается U+03AC (тонос). Канонически это одно и то же.
    const oxia = "καὶ τὸ πάζιον·";
    const tonos = "καὶ τὸ πάζιον";

    it("находит написанное иным знаком", () => {
        assert.equal(replaceNormalized(oxia, tonos, "καὶ τοπάζιον"), "καὶ τοπάζιον·");
    });

    it("не трогает композицию остального стиха", () => {
        const verse = `ὑπὲρ ${oxia}`;
        const out = replaceNormalized(verse, tonos, "καὶ τοπάζιον")!;
        assert.ok(out.includes("ὲ"), "остальной текст перезаписан нормализацией");
    });

    it("молчит, когда искомого нет", () => {
        assert.equal(replaceNormalized("ничего похожего", tonos, "x"), null);
    });
});

describe("письмо издания", () => {
    // Текст древнегреческий и набран политоникой: «ά» — U+1F71 (оксия). Тонос
    // U+03AC — знак новогреческой монотонии, и посреди этого текста он чужой.
    it("переводит современное ударение в старое", () => {
        assert.equal(toPolytonic("άέήί"), "άέήί");
        assert.equal(toPolytonic("όύώ"), "όύώ");
    });

    it("не трогает буквы без ударения и уже старые знаки", () => {
        assert.equal(toPolytonic("αβά"), "αβά");
    });

    it("оставляет гравис и придыхания как есть", () => {
        assert.equal(toPolytonic("ὶὸ"), "ὶὸ");
    });
});
