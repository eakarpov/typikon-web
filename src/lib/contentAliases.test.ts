import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";
import { aliasMatcher, aliasPatch, canonicalPath, withSearch, saveWithAlias, ALIAS_KEYS_INDEX } from "./contentAliases";

test("переименование, возврат и снятие алиаса сохраняют все прежние адреса", () => {
    const first = aliasPatch({ alias: "first" }, "second");
    assert.deepEqual(first, { alias: "second", aliases: ["first", "second"] });
    const back = aliasPatch(first, "first");
    assert.deepEqual(back.aliases, ["first", "second"]);
    assert.deepEqual(aliasPatch(back, ""), { alias: "", aliases: ["first", "second"] });
    assert.deepEqual(aliasPatch(first, undefined), first);
});

test("новый алиас не бывает URL, ObjectId или оператором Mongo", () => {
    for (const value of ["https://evil.test", "../other", "a?b", "a#b", "a/b", "имя", new ObjectId().toString(), { $gt: "" }]) {
        assert.throws(() => aliasPatch({}, value));
    }
    assert.equal(aliasPatch({}, "  kniga-1  ").alias, "kniga-1");
    assert.equal(aliasPatch({ alias: "старое имя" }, "старое имя").alias, "старое имя");
});

test("ID и прежние алиасы разрешаются без изменения постоянного идентификатора", () => {
    const id = new ObjectId();
    assert.deepEqual(aliasMatcher(String(id)), { _id: id });
    assert.deepEqual(aliasMatcher("old-name"), { $or: [{ alias: "old-name" }, { aliases: "old-name" }] });
    assert.equal(canonicalPath("library", { _id: id, alias: "book" }), "/library/book");
    assert.equal(canonicalPath("reading", { id: String(id) }), `/reading/${id}`);
});

test("канонический переход сохраняет параметры, повторы и выбор ударений", () => {
    assert.equal(withSearch("/reading/new", { accents: "1", tag: ["a", "b"], missing: undefined }),
        "/reading/new?accents=1&tag=a&tag=b");
    assert.equal(withSearch("/bible?v=cs", { v: "ro", accents: "1" }), "/bible?v=cs&accents=1");
});

test("Mongo: история зарезервирована, конфликт не меняет содержимое, конкурентный адрес единственный", {
    skip: process.env.RUN_ALIAS_MONGO_TESTS !== "1",
}, async () => {
    const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 3000 });
    const db = client.db(`typikon-alias-test-${randomUUID()}`);
    try {
        await client.connect();
        const books = db.collection("books");
        await books.createIndex({ aliases: 1 }, ALIAS_KEYS_INDEX);
        await books.createIndex({ alias: 1 }, { unique: true, partialFilterExpression: { alias: { $gt: "" } } });
        const a = new ObjectId(), b = new ObjectId();
        await books.insertMany([{ _id: a, alias: "old", aliases: ["old"], name: "A" },
            { _id: b, name: "B" }]);
        await saveWithAlias(db, "books", String(a), "new", { name: "A2" });
        assert.equal(String((await books.findOne(aliasMatcher("old")))?._id), String(a));
        await assert.rejects(saveWithAlias(db, "books", String(b), "old", { name: "lost" }), /занят|сохранён/);
        assert.equal((await books.findOne({ _id: b }))?.name, "B");
        await assert.rejects(books.updateOne({ _id: b }, { $set: { alias: "old", aliases: ["old"] } }),
            (e: unknown) => (e as { code: number }).code === 11000);
        await saveWithAlias(db, "books", String(a), "", {});
        assert.equal(String((await books.findOne(aliasMatcher("new")))?._id), String(a));
        assert.equal((await books.findOne({ _id: a }))?.alias, "");
        const attempts = await Promise.allSettled([
            saveWithAlias(db, "books", String(a), "shared", {}),
            saveWithAlias(db, "books", String(b), "shared", {}),
        ]);
        assert.equal(attempts.filter(r => r.status === "fulfilled").length, 1);
        assert.equal(await books.countDocuments({ aliases: "shared" }), 1);
        const texts = db.collection("texts");
        const text = new ObjectId();
        await texts.insertOne({ _id: text, name: "Text" });
        await db.collection("bible_books").insertOne({ alias: "old-bible" });
        await assert.rejects(saveWithAlias(db, "texts", String(text), "old-bible", {}), /библейским/);
        await assert.rejects(saveWithAlias(db, "texts", String(text), "random", {}), /служебной/);
    } finally {
        // Только созданная этим тестом БД с непредсказуемым именем, не typikon.
        await db.dropDatabase();
        await client.close();
    }
});
