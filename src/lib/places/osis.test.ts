import { test } from "node:test";
import assert from "node:assert/strict";
import { OSIS_TO_CANON, osisToKey } from "@/lib/places/osis";
import { BIBLE_CANON } from "@/utils/bibleCanon";

test("OSIS в книгу канона: Царства сдвинуты, Ездра и Неемия разведены", () => {
    assert.equal(osisToKey("Gen.35.19"), "bytie.35.19");
    assert.equal(osisToKey("1Sam.16.1"), "1-tsarstv.16.1");
    assert.equal(osisToKey("1Kgs.12.28"), "3-tsarstv.12.28");
    assert.equal(osisToKey("Ezra.2.21"), "1-ezdry.2.21");
    assert.equal(osisToKey("Neh.7.26"), "neemii.7.26");
    assert.equal(osisToKey("Tob.1.1"), null);
    assert.equal(osisToKey("Gen.35"), null);
});

test("каждая книга соответствия есть в каноне сайта", () => {
    const ids = new Set(BIBLE_CANON.map((b) => b.id));
    assert.deepEqual(Object.values(OSIS_TO_CANON).filter((id) => !ids.has(id)), []);
});
