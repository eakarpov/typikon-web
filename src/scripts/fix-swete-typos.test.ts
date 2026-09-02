import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { CORRECTIONS, replaceNormalized } from "./fix-swete-typos";

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

describe("запись издания", () => {
    // Издание приведено к NFC: «ά» — U+03AC. Знаки «с оксией» из Greek Extended
    // (U+1F71) канонически те же, но в тексте их больше нет, и правка не должна
    // возвращать их обратно.
    it("правки записаны в NFC", () => {
        CORRECTIONS.forEach((fix) => {
            assert.equal(fix.to, fix.to.normalize("NFC"), `${fix.canonRef}: «to» не в NFC`);
        });
    });

    it("находит написанное знаками Greek Extended и приводит к NFC", () => {
        const oxia = "\u03ba\u03b1\u1f76 \u03c4\u1f78 \u03c0\u1f71\u03b6\u03b9\u03bf\u03bd";
        const out = replaceNormalized(oxia, "καὶ τὸ πάζιον", "καὶ τοπάζιον".normalize("NFC"));
        assert.equal(out, "καὶ τοπάζιον".normalize("NFC"));
    });
});
