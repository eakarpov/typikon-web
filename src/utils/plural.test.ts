import { test } from "node:test";
import assert from "node:assert/strict";
import { temples } from "@/utils/plural";

test("счёт храмов склоняется по-русски", () => {
    assert.equal(temples(1), "1 храм");
    assert.equal(temples(3), "3 храма");
    assert.equal(temples(5), "5 храмов");
});

test("подростковые числа — исключение, а не правило", () => {
    // 11–14 идут как «много», хотя оканчиваются на 1–4.
    assert.equal(temples(11), "11 храмов");
    assert.equal(temples(12), "12 храмов");
    assert.equal(temples(14), "14 храмов");
    assert.equal(temples(21), "21 храм");
    assert.equal(temples(22), "22 храма");
    assert.equal(temples(111), "111 храмов");
    assert.equal(temples(1002), "1002 храма");
});
