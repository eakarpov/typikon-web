import { test } from "node:test";
import assert from "node:assert/strict";
import { deleteFootnote, editFootnote, insertFootnote, insertFootnoteReference, footnoteChoices, footnoteMarkers, footnoteReferenceCount, type FootnoteDocument } from "./footnoteEditing";
import { footnoteKey, footnoteNumbers, orderedFootnotes } from "./footnoteNumbers";
import { compileInlineFootnotes } from "./inlineFootnotes";

const document = (): FootnoteDocument => ({ content: "А{3} Б{1} В{3}", poems: "Стих{2}", footnotes: ["Первое", "В стихах", "Повтор"] });

test("existing-note insertion reuses the exact saved ID, preserves duplicate texts and shares future edits", () => {
    const doc = { content: "Текст{1}", poems: "Стих", footnotes: ["Одинаковый текст", "", "Одинаковый текст"] };
    const inserted = insertFootnoteReference(doc, { field: "poems", source: doc.poems, offset: 4 }, { kind: "number", number: 3 });
    assert.equal(inserted.poems, "Стих{3}");
    assert.strictEqual(inserted.footnotes, doc.footnotes);
    assert.deepEqual(compileInlineFootnotes(inserted.content, inserted.poems, inserted.footnotes), inserted);
    const edited = editFootnote(inserted, { kind: "number", number: 3 }, "Изменение общего пояснения");
    assert.deepEqual(edited.footnotes, ["Одинаковый текст", "", "Изменение общего пояснения"]);
    assert.equal(edited.poems, "Стих{3}");
    assert.deepEqual(footnoteNumbers(inserted), { "3": 1, "1": 2 });
});

test("choices include unreferenced saved notes and unsaved notes once, excluding deleted slots", () => {
    const doc = { content: "{1} {fn|Новая} {fn|Новая}", poems: "{fn|Сохранённая}", footnotes: ["Сохранённая", "", "Без меток"] };
    const choices = footnoteChoices(doc);
    assert.deepEqual(choices.map(choice => [choice.key, choice.text]), [["1", "Сохранённая"], ["3", "Без меток"], ["new:Новая", "Новая"]]);
    const selected = choices.find(choice => choice.key === "new:Новая")!;
    const inserted = insertFootnoteReference(doc, { field: "poems", offset: doc.poems.length, source: doc.poems }, selected.target);
    const saved = compileInlineFootnotes(inserted.content, inserted.poems, inserted.footnotes);
    assert.equal(saved.footnotes.length, 4);
    assert.equal(saved.content, "{1} {4} {4}");
    assert.equal(saved.poems, "{1}{4}");
    assert.equal(footnoteReferenceCount(saved, 4), 3);
    assert.equal(saved.footnotes[1], "");
});

test("existing-note insertion rejects deleted notes, invalid positions and stale source without altering text", () => {
    const doc = { content: "Текст {k|красный}", poems: "", footnotes: ["Пояснение", ""] };
    for (const number of [0, 2, 3]) assert.throws(() => insertFootnoteReference(doc, { field: "content", source: doc.content, offset: 0 }, { kind: "number", number }));
    assert.throws(() => insertFootnoteReference(doc, { field: "content", source: "Старый текст", offset: 0 }, { kind: "number", number: 1 }), /Текст изменился/);
    assert.throws(() => insertFootnoteReference(doc, { field: "content", source: doc.content, offset: 10 }, { kind: "number", number: 1 }));
    assert.equal(doc.content, "Текст {k|красный}");
    assert.deepEqual(doc.footnotes, ["Пояснение", ""]);
});

test("inserting at the cursor keeps surrounding text and existing footnote IDs intact", () => {
    const doc = { ...document(), content: "До слова после{3}" };
    const inserted = insertFootnote(doc, { field: "content", offset: 8, source: doc.content }, "  Пояснение  ");
    assert.equal(inserted.content, "До слова{fn|Пояснение} после{3}");
    assert.equal(inserted.poems, doc.poems);
    assert.strictEqual(inserted.footnotes, doc.footnotes);
    assert.equal(doc.content, "До слова после{3}");
    const saved = compileInlineFootnotes(inserted.content, inserted.poems, inserted.footnotes);
    assert.equal(saved.content, "До слова{4} после{3}");
    assert.deepEqual(saved.footnotes, [...doc.footnotes, "Пояснение"]);
});

test("insertion supports the start, end, poems, Unicode cursor offsets and multiple lines", () => {
    const doc = { content: "", poems: "😀 Сти́х\n\nЕщё стих", footnotes: [] };
    assert.equal(insertFootnote(doc, { field: "content", offset: 0, source: "" }, "Первая").content, "{fn|Первая}");
    const offset = doc.poems.indexOf("\n");
    assert.equal(insertFootnote(doc, { field: "poems", offset, source: doc.poems }, "Один\nДва").poems,
        "😀 Сти́х{fn|Один\nДва}\n\nЕщё стих");
    assert.equal(insertFootnote(doc, { field: "poems", offset: doc.poems.length, source: doc.poems }, "Конец").poems,
        doc.poems + "{fn|Конец}");
});

test("insertion rejects stale positions, invalid notes and positions inside existing corpus tags", () => {
    const doc = { content: "Текст {k|красный} {1}", poems: "", footnotes: ["Старая"] };
    const at = (offset: number, value = "Новая", source = doc.content) => insertFootnote(doc, { field: "content", offset, source }, value);
    for (const offset of [-1, 1.5, doc.content.length + 1, 10, doc.content.indexOf("{1}") + 1]) assert.throws(() => at(offset));
    assert.throws(() => at(0, "Новая", "Предыдущий текст"), /Текст изменился/);
    for (const value of [" ", "{k|Вложенная}"]) assert.throws(() => at(0, value));
    assert.ok(at(doc.content.indexOf("{1}")).content.includes("{fn|Новая}{1}"));
    assert.ok(at(doc.content.length).content.endsWith("{1}{fn|Новая}"));
});

test("editing a shared note changes all its occurrences without changing stable source IDs", () => {
    const original = document();
    const edited = editFootnote(original, { kind: "number", number: 3 }, "Новое пояснение\nПродолжение");
    assert.equal(footnoteReferenceCount(edited, 3), 2);
    assert.equal(edited.content, original.content);
    assert.equal(edited.footnotes[2], "Новое пояснение\nПродолжение");
    assert.equal(original.footnotes[2], "Повтор");
    assert.deepEqual(compileInlineFootnotes(edited.content, edited.poems, edited.footnotes), edited);
});

test("delete removes every reference in body and poems while preserving other IDs and text", () => {
    const original = { ...document(), content: "А{2} Б{12} В{2}", footnotes: Array.from({length: 12}, (_, i) => `Сноска ${i + 1}`) };
    const deleted = deleteFootnote(original, { kind: "number", number: 2 });
    assert.equal(deleted.content, "А Б{12} В");
    assert.equal(deleted.poems, "Стих");
    assert.equal(deleted.footnotes.length, 12);
    assert.equal(deleted.footnotes[1], "");
    assert.equal(deleted.footnotes[11], "Сноска 12");
    assert.equal(original.footnotes[1], "Сноска 2");
    const saved = compileInlineFootnotes(`${deleted.content} {fn|Новая}`, deleted.poems, deleted.footnotes);
    assert.equal(saved.content, "А Б{12} В {13}");
    assert.equal(saved.footnotes[1], "");
});

test("visible labels follow poems then body, deduplicate shared references, and keep stable anchors", () => {
    const original = document();
    const numbers = footnoteNumbers(original);
    assert.deepEqual(numbers, { "2": 1, "3": 2, "1": 3 });
    assert.deepEqual(orderedFootnotes(original.footnotes, numbers).map(n => [n.id, n.number]), [[2, 1], [3, 2], [1, 3]]);
    const deleted = deleteFootnote(original, { kind: "number", number: 2 });
    assert.deepEqual(footnoteNumbers(deleted), { "3": 1, "1": 2 });
    assert.equal(deleted.content, original.content);
    assert.deepEqual(footnoteNumbers({ ...original, content: "{1} {3}", poems: "" }), { "1": 1, "3": 2, "2": 3 });
});

test("unsaved repeated inline notes share editing and deletion; stale locations never replace unrelated text", () => {
    const original = { ...document(), content: "А{fn|Новая} Б{fn|Новая}" };
    const markers = footnoteMarkers(original.content, "content");
    const edited = editFootnote(original, markers[1].target, "Другая");
    assert.equal(edited.content, "А{fn|Другая} Б{fn|Другая}");
    assert.equal(deleteFootnote(original, markers[0].target).content, "А Б");
    assert.throws(() => editFootnote({ ...original, content: "Изменённый текст" }, markers[1].target, "Правка"), /Текст изменился/);
    assert.throws(() => editFootnote(original, markers[0].target, "{k|Нельзя}"));
    assert.throws(() => editFootnote(original, { kind: "number", number: 1 }, " "));
});

test("inline labels agree with persisted labels after compilation and never reuse a deleted ID", () => {
    const doc = { content: "{fn|Новая} {2} {fn|Новая} {fn|Старая}", poems: "", footnotes: ["", "Старая"] };
    const before = footnoteNumbers(doc);
    const keys = footnoteMarkers(doc.content, "content").map(m => before[footnoteKey(doc, m.target)]);
    const saved = compileInlineFootnotes(doc.content, doc.poems, doc.footnotes);
    const after = footnoteNumbers(saved);
    assert.deepEqual(keys, [1, 2, 1, 2]);
    assert.deepEqual(footnoteMarkers(saved.content, "content").map(m => after[footnoteKey(saved, m.target)]), keys);
    assert.equal(saved.content, "{3} {2} {3} {2}");
});

test("an unsaved inline reference to an existing note follows shared edits and cannot resurrect deletion", () => {
    const doc = { content: "А{1} Б{fn|Старая}", poems: "Стих{fn|Старая}", footnotes: ["Старая", "Другая"] };
    assert.equal(footnoteReferenceCount(doc, 1), 3);
    const edited = editFootnote(doc, { kind: "number", number: 1 }, "Исправленная");
    assert.equal(edited.content, "А{1} Б{1}");
    assert.equal(edited.poems, "Стих{1}");
    assert.equal(edited.footnotes[0], "Исправленная");
    const marker = footnoteMarkers(doc.poems, "poems")[0];
    const deleted = deleteFootnote(doc, marker.target);
    assert.deepEqual(deleted, { content: "А Б", poems: "Стих", footnotes: ["", "Другая"] });
    assert.deepEqual(compileInlineFootnotes(deleted.content, deleted.poems, deleted.footnotes), deleted);
});

test("empty deleted slots are hidden; biblical citations do not consume ordinary endnote numbers", () => {
    const doc = { content: "{3} {2}", poems: "", footnotes: ["", "Пояснение", "Ин. 1:1"] };
    assert.deepEqual(footnoteNumbers(doc), { "2": 1 });
    assert.deepEqual(orderedFootnotes(doc.footnotes, footnoteNumbers(doc)), [{ id: 2, text: "Пояснение", number: 1 }]);
    assert.deepEqual(footnoteNumbers(doc, true), { "3": 1, "2": 2 });
});
