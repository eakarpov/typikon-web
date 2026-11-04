const fs = require("fs");
const path = require("path");
const input = process.env.STUDY_FIXTURES_DIR;
if (!input)
  throw Error("Set STUDY_FIXTURES_DIR to public-source fixture directory");
const { MongoClient, ObjectId } = require("mongodb");
(async () => {
  const c = await new MongoClient("mongodb://127.0.0.1:27129").connect();
  try {
    const db = c.db("typikon");
    const rows = JSON.parse(
      fs.readFileSync(path.join(input, "study-corpus.json"), "utf8"),
    );
    for (const b of rows) {
      await db
        .collection("books")
        .replaceOne(
          { _id: new ObjectId(b.id) },
          {
            _id: new ObjectId(b.id),
            name: b.title,
            author: b.author,
            language: b.language,
            category: /Пролог|Лавсаик/.test(b.title)
              ? "hagiographic"
              : "patristic",
            public: true,
            texts: b.texts.map((t) => new ObjectId(t.id)),
          },
          { upsert: true },
        );
      for (const t of b.texts)
        await db
          .collection("texts")
          .replaceOne(
            { _id: new ObjectId(t.id) },
            {
              _id: new ObjectId(t.id),
              bookId: new ObjectId(b.id),
              name: t.title,
              content: t.content,
              footnotes: t.footnotes ?? [],
              link: t.source,
              language: b.language,
              readiness: "ready",
            },
            { upsert: true },
          );
    }
    const bible = JSON.parse(
      fs.readFileSync(path.join(input, "study-bible.json"), "utf8"),
    );
    const edition = {
      ...bible.edition,
      _id: new ObjectId(bible.edition._id),
      bookId: bible.edition.bookId ? new ObjectId(bible.edition.bookId) : null,
    };
    await db
      .collection("bible_editions")
      .replaceOne({ _id: edition._id }, edition, { upsert: true });
    for (const v of bible.verses)
      await db
        .collection("bible_verses")
        .replaceOne(
          { _id: new ObjectId(v._id) },
          { ...v, _id: new ObjectId(v._id), editionId: edition._id },
          { upsert: true },
        );
    console.log("Seeded public-source fixtures in local test DB only.");
  } finally {
    await c.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
