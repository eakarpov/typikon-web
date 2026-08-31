import test from "node:test";
import assert from "node:assert/strict";
import { BIBLE_CANON } from "@/utils/bibleCanon";
import {
    BIBLE_EDITION_CANONS, absentFromCanon, bibleEditionCanonTitle, outsideBibleEditionCanon,
} from "@/utils/bibleEditionCanon";

test("эталонный канон не отнимает ничего", () => {
    assert.deepEqual(absentFromCanon("sla"), []);
    assert.equal(outsideBibleEditionCanon("sla", "3-makkaveyskaya"), false);
});

test("греческий не держит 3 Ездры, латинский — 3 Маккавейскую", () => {
    assert.equal(outsideBibleEditionCanon("grc-lxx", "3-ezdry"), true);
    assert.equal(outsideBibleEditionCanon("grc-lxx", "3-makkaveyskaya"), false);
    assert.equal(outsideBibleEditionCanon("la-vulgata", "3-makkaveyskaya"), true);
    assert.equal(outsideBibleEditionCanon("la-vulgata", "3-ezdry"), false);
});

test("незнакомый канон ничего не отнимает — дыры продолжают искаться", () => {
    assert.equal(outsideBibleEditionCanon("невнятица", "3-ezdry"), false);
    assert.equal(outsideBibleEditionCanon(null, "3-ezdry"), false);
    assert.equal(bibleEditionCanonTitle("невнятица"), "славянский");
});

test("отсутствующие книги называются по-русски", () => {
    assert.deepEqual(absentFromCanon("la-vulgata"), ["3-я Маккавейская"]);
});

test("всё отнимаемое — настоящие книги эталона", () => {
    // Опечатка в списке молча сняла бы проверку с книги, которой нет в каноне.
    const ids = new Set(BIBLE_CANON.map((book) => book.id));
    BIBLE_EDITION_CANONS.forEach((canon) => canon.absent.forEach((id) => {
        assert.ok(ids.has(id), `канон «${canon.id}» отнимает «${id}», а такой книги в эталоне нет`);
    }));
});
