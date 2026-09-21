import {test} from "node:test";
import assert from "node:assert/strict";
import {PLACE_MARK, RED_MARK, SAINT_MARK, splitLinkMark} from "./patterns";

const bodies = (pattern: RegExp, text: string) => [...text.matchAll(pattern)].map((m) => m[1]);

test("две метки места в абзаце — две ссылки, а не одна", () => {
    assert.deepEqual(
        bodies(PLACE_MARK, "из {pl|athens|Афины} и {pl|corinth|Коринфа} пришли"),
        ["athens|Афины", "corinth|Коринфа"],
    );
});

test("две киновари в абзаце не красят текст между собой", () => {
    assert.deepEqual(bodies(RED_MARK, "{k|Слава:} текст {k|И ныне:} ещё"), ["Слава:", "И ныне:"]);
});

test("метка святого рядом с меткой места не съедает её", () => {
    assert.deepEqual(bodies(SAINT_MARK, "{st|paul|Павел} в {pl|athens|Афинах}"), ["paul|Павел"]);
});

test("подпись необязательна", () => {
    assert.deepEqual(splitLinkMark("athens|Афины"), { id: "athens", label: "Афины" });
    assert.deepEqual(splitLinkMark("athens"), { id: "athens", label: "athens" });
    assert.deepEqual(splitLinkMark("athens|"), { id: "athens", label: "athens" });
});
