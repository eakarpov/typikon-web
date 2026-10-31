import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { resolveDayAddress } from "./dayRedirect";

test("старая Пасха по ID и алиасу ведёт на полную карточку; цикл и потерянная цель не скрываются", {
    skip: process.env.RUN_ALIAS_MONGO_TESTS !== "1",
}, async () => {
    const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 3000 });
    const db = client.db(`typikon-day-test-${randomUUID()}`);
    try {
        await client.connect();
        const current = new ObjectId(), old = new ObjectId(), week = new ObjectId();
        await db.collection("weeks").insertOne({ _id: week, penticostration: true });
        await db.collection("days").insertMany([
            { _id: current, alias: "pascha", weekId: week },
            { _id: old, alias: "strastnaja-nedelja", redirectTo: current, weekId: null },
        ]);
        for (const address of [String(old), "strastnaja-nedelja"]) {
            const found = await resolveDayAddress(db, address);
            assert.equal(String(found?.id), String(current));
            assert.equal(found?.redirectPath, "/penticostarion/pascha");
        }
        assert.equal((await resolveDayAddress(db, "pascha"))?.redirectPath, null);
        assert.equal(await resolveDayAddress(db, "missing"), null);
        await db.collection("days").updateOne({ _id: current }, { $set: { redirectTo: old } });
        await assert.rejects(resolveDayAddress(db, String(old)), /Цикл/);
        await db.collection("days").updateOne({ _id: current }, { $set: { redirectTo: new ObjectId() } });
        await assert.rejects(resolveDayAddress(db, String(old)), /отсутствует/);
    } finally {
        await db.dropDatabase();
        await client.close();
    }
});
