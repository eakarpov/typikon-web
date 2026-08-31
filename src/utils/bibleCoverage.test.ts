import test from "node:test";
import assert from "node:assert/strict";
import { coverageNote, coveragePercent } from "@/utils/bibleCoverage";

test("доля считается от общего числа зачал", () => {
    assert.equal(coveragePercent({ total: 1067, served: 400 }), 37);
    assert.equal(coveragePercent({ total: 1067, served: 788 }), 74);
    assert.equal(coveragePercent({ total: 0, served: 0 }), 0);
});

test("полное покрытие пометы не получает", () => {
    // Иначе она стояла бы у всех четырёх нынешних изданий и значила бы «ничего».
    assert.equal(coverageNote({ total: 1067, served: 1067 }), null);
});

test("мерить нечего — молчим", () => {
    assert.equal(coverageNote(null), null);
    assert.equal(coverageNote({ total: 0, served: 0 }), null);
});

test("Четвероевангелие: доля и раздел, которого нет", () => {
    const note = coverageNote({
        total: 1067, served: 400,
        parts: { gospel: { total: 400, served: 400 }, apostle: { total: 388, served: 0 },
                 ot: { total: 279, served: 0 } },
    });
    assert.ok(note?.startsWith("отдаёт 37% чтений года"), note ?? "нет пометы");
    assert.ok(note?.includes("Евангелие — весь"), note ?? "");
    assert.ok(note?.includes("Апостол — нет"), note ?? "");
});

test("частично покрытый раздел показывается долей", () => {
    const note = coverageNote({
        total: 100, served: 50,
        parts: { gospel: { total: 50, served: 25 } },
    });
    assert.ok(note?.includes("Евангелие — 50%"), note ?? "");
});
