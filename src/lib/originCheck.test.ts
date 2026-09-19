import {test} from "node:test";
import assert from "node:assert/strict";
import {isForeignOrigin, isUnsafeMethod} from "./originCheck";

test("без заголовка — не браузер, не наше дело", () => {
    assert.equal(isForeignOrigin(null, "www.typikon.info"), false);
    assert.equal(isForeignOrigin("", "www.typikon.info"), false);
});

test("свой сайт в обеих формах, старый адрес и локальная разработка — свои", () => {
    assert.equal(isForeignOrigin("https://www.typikon.info", "www.typikon.info"), false);
    assert.equal(isForeignOrigin("https://typikon.info", "www.typikon.info"), false);
    assert.equal(isForeignOrigin("https://www.typikon.su", "www.typikon.su"), false);
    assert.equal(isForeignOrigin("http://localhost:3000", "localhost:3000"), false);
});

test("чужой сайт, похожее имя и «null» — чужие", () => {
    assert.equal(isForeignOrigin("https://evil.example", "www.typikon.info"), true);
    assert.equal(isForeignOrigin("https://typikon.info.evil.example", "www.typikon.info"), true);
    assert.equal(isForeignOrigin("https://eviltypikon.info", "www.typikon.info"), true);
    assert.equal(isForeignOrigin("null", "www.typikon.info"), true);
});

test("изменяющие методы", () => {
    assert.equal(isUnsafeMethod("post"), true);
    assert.equal(isUnsafeMethod("DELETE"), true);
    assert.equal(isUnsafeMethod("GET"), false);
});
