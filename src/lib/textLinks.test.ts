import test from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { textLinks, validTextLinks, legacyTextLinks } from "./textLinks";

test("scalar, null, arrays and duplicate links normalize to a stable list", () => {
    assert.deepEqual(textLinks(" https://example.org/a "), ["https://example.org/a"]);
    assert.deepEqual(textLinks(null), []);
    assert.deepEqual(textLinks(["https://a.org", "", "https://b.org", "https://a.org"]), ["https://a.org", "https://b.org"]);
});
test("editor accepts both formats and rejects executable or malformed URLs", () => {
    assert.deepEqual(validTextLinks(["https://a.org", "http://b.org"]), ["https://a.org", "http://b.org"]);
    for (const value of ["javascript:alert(1)", "data:text/html,test", "not a URL", {}, [1]]) assert.throws(() => validTextLinks(value));
});
test("legacy mobile responses preserve scalar types throughout nested calendar trees", () => {
    const id = new ObjectId(), date = new Date();
    const doc = { _id: id, date, day: { items: [{ text: { link: ["https://a.org", "https://b.org"], ruLink: [] } }] } };
    const old = legacyTextLinks(doc);
    assert.equal(old.day.items[0].text.link, "https://a.org");
    assert.equal(old.day.items[0].text.ruLink, null);
    assert.equal(old._id, id);
    assert.equal(old.date, date);
    assert.deepEqual(doc.day.items[0].text.link, ["https://a.org", "https://b.org"]);
});
