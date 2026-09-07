import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRef, groupByEdition, parseRef } from "@/lib/bible/concordance";

describe("адрес стиха", () => {
    it("разбирается из трёх частей", () => {
        assert.deepEqual(parseRef("bytie.1.1"), { book: "bytie", chapter: 1, verse: 1 });
        assert.deepEqual(parseRef("4-tsarstv.6.2"), { book: "4-tsarstv", chapter: 6, verse: 2 });
    });

    it("терпит пробелы по краям", () => {
        assert.deepEqual(parseRef("  in.3.16 "), { book: "in", chapter: 3, verse: 16 });
    });

    it("отвергает всё, что не адрес", () => {
        // Пустое, неполное, лишнее, нечисловое, нулевое и отрицательное — каждый
        // случай отдельной строкой: молча ответить про другой стих хуже, чем отказать.
        for (const bad of ["", "bytie", "bytie.1", "bytie.1.1.1", "bytie.a.1", "bytie.1.a",
            "bytie.0.1", "bytie.1.0", "bytie.-1.1", "Bytie.1.1", "быт.1.1", "bytie.1.5x"]) {
            assert.equal(parseRef(bad), null, `должно быть отвергнуто: ${JSON.stringify(bad)}`);
        }
    });

    it("собирается обратно в ту же строку", () => {
        const ref = parseRef("psaltir.9.13")!;
        assert.equal(formatRef(ref), "psaltir.9.13");
    });
});

describe("сведение мест по изданиям", () => {
    const rows = [
        { edition: "ro-1688", book: "psaltiri", chapter: 9, verse: 13 },
        { edition: "cs-eliz", book: "psaltir", chapter: 9, verse: 13 },
        { edition: "grc-lxx-pat", book: "psaltir", chapter: 9, verse: 13 },
    ];

    it("ставит издания в заданном порядке", () => {
        const out = groupByEdition(rows, ["cs-eliz", "ro-1688", "grc-lxx-pat"]);
        assert.deepEqual(out.map((e) => e.edition), ["cs-eliz", "ro-1688", "grc-lxx-pat"]);
    });

    it("не теряет издание, которого нет в перечне порядка", () => {
        // Порядок задан базой и может отстать от состава: издание, о котором он
        // ещё не знает, должно попасть в ответ, а не пропасть.
        const out = groupByEdition(rows, ["cs-eliz"]);
        assert.deepEqual(out.map((e) => e.edition), ["cs-eliz", "grc-lxx-pat", "ro-1688"]);
    });

    it("собирает разорванный стих в одно издание и по порядку счёта", () => {
        const split = [
            { edition: "ro-1688", book: "levit", chapter: 15, verse: 3 },
            { edition: "cs-eliz", book: "levit", chapter: 15, verse: 2 },
            { edition: "ro-1688", book: "levit", chapter: 15, verse: 2 },
        ];
        const out = groupByEdition(split, ["cs-eliz", "ro-1688"]);

        assert.equal(out.length, 2);
        const romanian = out.find((e) => e.edition === "ro-1688")!;
        assert.deepEqual(romanian.places.map((p) => p.verse), [2, 3]);
    });

    it("на пустом наборе отдаёт пустой список", () => {
        assert.deepEqual(groupByEdition([], ["cs-eliz"]), []);
    });
});
