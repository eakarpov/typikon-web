import { test } from "node:test";
import assert from "node:assert/strict";
import { articleForms } from "@/lib/places/nikiforReview";

test("формы по заглавию статьи: уточнение в скобках снимается, перечень делится", () => {
    assert.deepEqual(articleForms("Авва (город)"), ["Авва"]);
    assert.deepEqual(articleForms("Киринеи, Киринеянин, Кирены"), ["Киринеи", "Киринеянин", "Кирены"]);
    assert.deepEqual(articleForms("Аварим, Аваримские горы"), ["Аварим", "Аваримские горы"]);
    assert.deepEqual(articleForms("Кармил"), ["Кармил"]);
});
