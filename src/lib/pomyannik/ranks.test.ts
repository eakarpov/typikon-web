import { test } from "node:test";
import assert from "node:assert/strict";
import { RANKS, RANK_BY_KEY } from "./types";
import { parseLine } from "./parse";
import { withInitialBreathing } from "./breathing";

test("specific clergy ranks are selectable and understood by import", () => {
    for (const key of ["episkop", "arhiepiskop", "mitropolit", "patriarh", "protopresviter", "ierodiakon", "shiarhimandrit"]) {
        const rank = RANKS.find(r => r.key === key)!;
        assert.ok(rank);
        assert.equal(parseLine(`Николай, ${rank.label}`).person?.rank, key);
        assert.equal(parseLine(`Николай, ${rank.genitive}`).person?.rank, key);
    }
    assert.equal(RANKS.some(r => r.key === "arhierey"), false);
    assert.ok(RANK_BY_KEY.arhierey); // Existing backups remain readable.
    assert.equal(parseLine("Николай, еп.").person?.rank, "episkop");
});

test("initial vowels receive breathing without changing accent or doubling marks", () => {
    for (const [input, expected] of [
        ["Анны", "А҆нны"], ["іоа́нна", "і҆оа́нна"], ["ѻ́льги", "ѻ҆́льги"],
        ["ᲂусти́ны", "ᲂу҆сти́ны"], ["Марі́и-Анны", "Марі́и-А҆нны"],
        ["а҆нны", "а҆нны"], ["Никола́ѧ", "Никола́ѧ"],
    ]) {
        assert.equal(withInitialBreathing(input), expected);
        assert.equal(withInitialBreathing(expected), expected);
    }
});
