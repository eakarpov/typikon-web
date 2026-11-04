import { test } from "node:test";
import assert from "node:assert/strict";
import {
  queueOperation,
  relationAt,
  rangeTarget,
  blocksOf,
  fingerprint,
  locate,
  targetAt,
  validateEntity,
  validateTarget,
  exportMarkdown,
  type Material,
} from "./core";
import routes from "@/data/study/routes.json";
import relations from "@/data/study/relations.json";
const source = (s: string): Material => ({
  target: { kind: "text", id: "text", edition: "edition" },
  title: "Книга",
  language: "cu",
  sourceHash: fingerprint(s),
  blocks: blocksOf(s),
  metadata: {},
  footnotes: [],
  missing: [],
});
test("portable source fingerprints and paragraph occurrence IDs", () => {
  assert.equal(fingerprint("hello"), "4f9f2cab");
  const blocks = blocksOf("Слово\n\nСлово");
  assert.notEqual(blocks[0].id, blocks[1].id);
});
test("precise quote survives a change in an unrelated paragraph", () => {
  const m = source("Первый текст\n\nВторой текст"),
    t = targetAt(m, m.blocks[1], "текст");
  assert.equal(
    locate(source("Изменён первый\n\nВторой текст"), t)?.block.text,
    "Второй текст",
  );
});
test("a quote with competing repeated occurrences is never guessed", () => {
  const m = source("дубль дубль\n\nдубль");
  assert.equal(locate(m, { kind: "text", id: "text", quote: "дубль" }), null);
  const old = source("дубль\n\nдубль"),
    t = targetAt(old, old.blocks[1]);
  assert.equal(locate(source("вставка\n\nдубль\n\nдубль"), t), null);
});
test("edition identities and modified quotes cannot silently move a note", () => {
  const m = source("Исходная мысль"),
    t = targetAt(m, m.blocks[0]);
  assert.equal(
    locate({ ...m, target: { ...m.target, edition: "other" } }, t),
    null,
  );
  assert.equal(locate(source("Исправленная мысль"), t), null);
});
test("Bible anchors use a concrete edition and canonical verse", () => {
  assert.throws(() =>
    validateTarget({ kind: "bible", id: "psaltir", chapter: 50 }),
  );
  assert.throws(() =>
    validateTarget({
      kind: "bible",
      id: "psaltir",
      edition: "cs-eliz",
      chapter: 50,
      verseFrom: 12,
      verseTo: 3,
    }),
  );
});
test("highlights need no comment and questions retain their own status", () => {
  const d = validateEntity("records", {
    id: "record",
    kind: "highlight",
    target: { kind: "text", id: "book" },
    note: "",
  });
  assert.equal(d.note, "");
  assert.equal(
    validateEntity("records", {
      ...d,
      kind: "question",
      questionStatus: "resolved",
    }).questionStatus,
    "resolved",
  );
});
test("notebooks allow repeated sources with unique occurrence IDs", () => {
  const t = { kind: "text", id: "source" };
  assert.equal(
    validateEntity("collections", {
      id: "c",
      title: "Тема",
      items: [
        { id: "a", kind: "source", title: "Первое", target: t },
        { id: "b", kind: "source", title: "Второе", target: t },
      ],
    }).items.length,
    2,
  );
  assert.throws(() =>
    validateEntity("collections", {
      id: "c",
      title: "Тема",
      items: [
        { id: "a", kind: "section", title: "1" },
        { id: "a", kind: "section", title: "2" },
      ],
    }),
  );
});
test("reading completion is a separate explicit state", () => {
  assert.equal(
    validateEntity("positions", {
      id: "p",
      title: "Книга",
      target: { kind: "text", id: "source" },
    }).status,
    "reading",
  );
  assert.equal(
    validateEntity("positions", {
      id: "p",
      title: "Книга",
      target: { kind: "text", id: "source" },
      status: "read",
    }).status,
    "read",
  );
});
test("editorial routes contain checked, source-addressed fragments and no empty placeholder", () => {
  assert.equal(routes.routes.length, 3);
  for (const r of routes.routes) {
    assert.equal(r.status, "checked");
    assert.ok(r.items.length >= 5 && r.items.length <= 8);
    for (const i of r.items) {
      validateTarget(i.target);
      assert.ok(i.source && i.comment);
      if (i.target.kind !== "bible")
        assert.ok((i.target as any).quote && (i.target as any).sourceHash);
    }
  }
  for (const r of relations.relations) {
    assert.equal(r.status, "checked");
    assert.ok(r.locator && r.author && r.reason);
    validateTarget(r.from);
    validateTarget(r.to);
  }
  assert.ok(relations.relations.some((r) => r.kind === "citation"));
  assert.ok(relations.relations.some((r) => r.kind === "commentary"));
});
test("exports keep quote, question and source together", () => {
  const result = exportMarkdown({
    collections: [],
    links: [],
    positions: [],
    records: [
      {
        id: "n",
        revision: 0,
        kind: "question",
        questionStatus: "open",
        target: { kind: "text", id: "book", quote: "Цитата" },
        note: "Почему?",
        tags: [],
      },
    ],
  });
  assert.ok(result.includes("Цитата"));
  assert.ok(result.includes("Почему?"));
  assert.ok(result.includes("/study?target="));
});

test("ranges retain both ends and overlapping phrase occurrences are stable", () => {
  const m = source("абаба абаба\n\nВторой\n\nТретий");
  const t = rangeTarget(m, m.blocks[0].id, m.blocks[1].id);
  assert.equal(locate(m, t)?.endBlock?.id, m.blocks[1].id);
  assert.equal(t.quote, "абаба абаба\n\nВторой");
  const q = targetAt(m, m.blocks[0], "аба", 6);
  assert.equal(q.occurrence, 2);
  assert.equal(locate(m, q)?.offset, 6);
  assert.equal(locate(m, { ...t, endBlockId: "absent" }), null);
});
test("rebound exports preserve the original quotation and original address", () => {
  const p: any = {
    ...{ collections: [], positions: [], links: [] },
    records: [
      {
        kind: "note",
        target: { kind: "text", id: "new", quote: "Уточнение" },
        originalTarget: { kind: "text", id: "old" },
        originalQuote: "Первоначальная выписка",
        note: "Мысль",
      },
    ],
  };
  const text = exportMarkdown(p);
  assert.ok(text.includes("Первоначальная выписка"));
  assert.ok(text.includes("old"));
  assert.ok(text.includes("Уточнённое место"));
});

test("relations cannot borrow a different Bible book with an equal chapter number", () => {
  const m: Material = {
    ...source("В начале"),
    target: { kind: "bible", id: "ioanna", edition: "cs-eliz", chapter: 1 },
    blocks: [{ id: "v-1", hash: "h", text: "В начале", index: 0, verse: 1 }],
  };
  const current: any = { ...m.target, verseFrom: 1, verseTo: 5 };
  const acts: any = {
    kind: "bible",
    id: "deyaniya",
    edition: "cs-eliz",
    chapter: 1,
    verseFrom: 1,
    verseTo: 3,
  };
  assert.equal(
    relationAt({ from: { kind: "text", id: "homily" }, to: acts }, m, current),
    null,
  );
  assert.deepEqual(
    relationAt(
      { from: current, to: { kind: "text", id: "homily" } },
      m,
      current,
    ),
    { side: "from", other: { kind: "text", id: "homily" } },
  );
  assert.equal(
    relationAt({ from: { ...current, chapter: 2 }, to: acts }, m, current),
    null,
  );
});
test("relations match either exact fragment within a source and return the opposite address", () => {
  const m = source("Начало\n\nКонец"),
    a = targetAt(m, m.blocks[0]),
    b = targetAt(m, m.blocks[1]);
  const at = relationAt({ from: a, to: b }, m, b);
  assert.equal(at?.side, "to");
  assert.deepEqual(at?.other, a);
  assert.equal(
    relationAt(
      {
        from: { ...a, sourceHash: "old" },
        to: { kind: "text", id: "another" },
      },
      m,
      a,
    ),
    null,
  );
});

test("a manual correction replaces a rejected save without changing retryable operation IDs", () => {
  const a = {
      entity: "records",
      value: { id: "note" },
      opId: "bad",
      refused: true,
    },
    b = { entity: "records", value: { id: "other" }, opId: "retry" },
    c = {
      entity: "records",
      value: { id: "note", note: "corrected" },
      opId: "new",
    };
  assert.deepEqual(
    queueOperation([a, b], c).map((p) => p.opId),
    ["retry", "new"],
  );
  assert.deepEqual(
    queueOperation([{ ...a, refused: false }, b], c).map((p) => p.opId),
    ["bad", "retry", "new"],
  );
});
