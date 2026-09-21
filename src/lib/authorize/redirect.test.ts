import {test} from "node:test";
import assert from "node:assert/strict";
import {safeNextPath} from "./redirect";

test("обычный путь внутри сайта проходит как есть", () => {
    assert.equal(safeNextPath("/pomyannik"), "/pomyannik");
    assert.equal(safeNextPath("/reading/kanon?accented=1"), "/reading/kanon?accented=1");
});

test("чужой адрес не становится местом возврата", () => {
    // Все три формы браузер уводит на чужой хост, и две последние выглядят
    // путём — ради них проверка и написана.
    assert.equal(safeNextPath("https://example.org/"), "/");
    assert.equal(safeNextPath("//example.org/"), "/");
    assert.equal(safeNextPath("/\\example.org/"), "/");
});

test("возврат на саму страницу входа — петля, и он не принимается", () => {
    assert.equal(safeNextPath("/login"), "/");
    assert.equal(safeNextPath("/login?next=%2F"), "/");
});

test("отсутствующее и нестроковое значение приводят на главную", () => {
    assert.equal(safeNextPath(null), "/");
    assert.equal(safeNextPath(undefined), "/");
    assert.equal(safeNextPath(42), "/");
    assert.equal(safeNextPath("pomyannik"), "/");
});
