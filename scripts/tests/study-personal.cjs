const assert = require("assert/strict");
const { MongoClient, ObjectId } = require("mongodb");
(async () => {
  const { SignJWT } = await import("jose");
  const con = await new MongoClient("mongodb://127.0.0.1:27129").connect();
  try {
    const d = con.db("typikon-users");
    const headers = {
      "Content-Type": "application/json",
      "Sec-Fetch-Site": "same-origin",
      Referer: "http://127.0.0.1:3121/study",
    };
    const userA = new ObjectId().toString(),
      userB = new ObjectId().toString();
    async function session(user) {
      const _id = new ObjectId();
      await d
        .collection("sessions")
        .insertOne({
          _id,
          id: user,
          expiresAt: new Date(Date.now() + 3600000),
        });
      return new SignJWT({ sessionId: _id.toString(), userId: user })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
        .sign(new TextEncoder().encode("study-local-fixture-only"));
    }
    const a = await session(userA),
      b = await session(userB);
    async function req(path, body, cookie = a) {
      const r = await fetch("http://127.0.0.1:3121/api/" + path, {
        method: body ? "POST" : "GET",
        headers: {
          ...headers,
          ...(cookie ? { Cookie: "session=" + cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const raw = await r.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw Error(path + " " + r.status + " " + raw.slice(0, 160));
      }
      return { status: r.status, data };
    }
    const target = { kind: "text", id: "695ac532c8b9c9425def3a4e" };
    const note = {
      id: new ObjectId().toString(),
      kind: "question",
      note: "PRIVATE_FIXTURE_QUESTION",
      tags: ["молитва"],
      questionStatus: "open",
      target,
    };
    const op = {
      entity: "records",
      value: note,
      revision: 0,
      opId: "create-note-" + userA,
      expectedUserId: userA,
    };
    let r = await req("v2/study/change", op);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.value.revision, 1);
    r = await req("v2/study/change", op);
    assert.equal(r.data.value.revision, 1);
    console.log("Receipt replay is idempotent");
    r = await req("v2/study/change", { ...op, opId: "stale-op-" + userA });
    assert.equal(r.status, 409);
    assert.equal(r.data.error.remote.note, note.note);
    r = await req("v2/study/change", {
      ...op,
      expectedUserId: userB,
      opId: "wrong-owner-" + userA,
    });
    assert.equal(r.status, 409);
    r = await req("v2/study/personal", undefined, b);
    assert.equal(r.data.state.records.length, 0);
    r = await req(
      "v2/study/change",
      { ...op, expectedUserId: userB, opId: "collision-" + userB },
      b,
    );
    assert.equal(r.status, 409);
    assert.equal(r.data.error.remote, null);
    console.log("Owner isolation and conflicts passed");
    const legacyId = new ObjectId();
    await d
      .collection("userNotes")
      .insertOne({
        _id: legacyId,
        userId: userA,
        textId: target.id,
        selection: {
          type: "paragraph",
          phrase: "Старая цитата",
          paragraphIndex: 3,
        },
        note: "Старая заметка",
      });
    r = await req("v2/study/personal");
    assert.ok(
      r.data.state.records.some(
        (n) =>
          n.id === String(legacyId) &&
          n.legacy &&
          n.target.quote === "Старая цитата",
      ),
    );
    console.log("Legacy notes retain IDs and quotations");
    const cid = new ObjectId().toString();
    const notebook = {
      id: cid,
      title: "Fixture notebook",
      description: "Public description",
      items: [
        { id: "section", kind: "section", title: "Раздел" },
        { id: "source", kind: "source", title: "Лествица", target },
        { id: "personal", kind: "record", title: "Вопрос", recordId: note.id },
      ],
    };
    r = await req("v2/study/change", {
      entity: "collections",
      value: notebook,
      revision: 0,
      opId: "create-collection-" + cid,
      expectedUserId: userA,
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await req("v2/study/plan", {
      action: "preview",
      id: cid,
      revision: 1,
      expectedUserId: userA,
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.excludedRecords, 1);
    r = await req("v2/study/plan", {
      action: "create",
      id: cid,
      revision: 1,
      date: "2026-11-05",
      expectedUserId: userA,
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const planId = r.data.id;
    await d
      .collection("readingPlans")
      .updateOne({ _id: userA }, { $set: { cursor: 1 } });
    r = await req("v2/study/plan", {
      action: "create",
      id: cid,
      revision: 1,
      date: "2026-11-05",
      expectedUserId: userA,
    });
    assert.equal(r.data.id, planId);
    assert.equal(
      (await d.collection("readingPlans").findOne({ _id: userA })).cursor,
      1,
    );
    console.log(
      "Explicit notebook reading plan retry keeps its existing cursor",
    );
    const bad = {
      ...note,
      id: new ObjectId().toString(),
      target: { ...target, quote: "THIS PHRASE IS NOT IN THE SOURCE" },
    };
    r = await req("v2/study/change", {
      entity: "records",
      value: bad,
      revision: 0,
      opId: "invalid-quote-" + userA,
      expectedUserId: userA,
    });
    assert.equal(r.status, 400);
    console.log("Invalid source quotations cannot acquire a checked binding");
    r = await req("v2/study/publish", {
      id: cid,
      revision: 1,
      recordIds: [],
      expectedUserId: userA,
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const token = r.data.token;
    r = await req("v2/study/shared?token=" + token, undefined, null);
    assert.equal(r.status, 200);
    assert.ok(!JSON.stringify(r.data).includes(note.note));
    assert.ok(!JSON.stringify(r.data).includes(userA));
    console.log(
      "Shared snapshots exclude unselected private notes and owner identifiers",
    );
    r = await req("v2/study/publish", {
      id: cid,
      revision: 1,
      recordIds: [note.id],
      expectedUserId: userA,
    });
    const included = r.data.token;
    r = await req("v2/study/shared?token=" + included, undefined, null);
    assert.ok(JSON.stringify(r.data).includes(note.note));
    const corpus = con.db("typikon");
    const text = await corpus
      .collection("texts")
      .findOne({ _id: new ObjectId(target.id) });
    await corpus
      .collection("books")
      .updateOne({ _id: text.bookId }, { $set: { public: false } });
    r = await req("v2/study/shared?token=" + included, undefined, null);
    assert.ok(!JSON.stringify(r.data).includes(note.note));
    await corpus
      .collection("books")
      .updateOne({ _id: text.bookId }, { $set: { public: true } });
    console.log("Withdrawn sources are not exposed by an old share");
    r = await req("v2/study/publish", {
      action: "unpublish",
      id: cid,
      revision: 1,
      expectedUserId: userA,
    });
    assert.equal(r.status, 200);
    r = await req("v2/study/shared?token=" + token, undefined, null);
    assert.equal(r.status, 404);
    r = await req("v2/study/change", {
      ...op,
      value: { ...note, note: "deleted" },
      revision: 1,
      deleted: true,
      opId: "delete-note-" + userA,
    });
    assert.equal(r.status, 200);
    r = await req("v2/study/personal");
    assert.ok(!r.data.state.records.some((n) => n.id === note.id));
    console.log("Unpublishing and deletion passed");
    console.log("ALL PERSONAL INTEGRATION CHECKS PASSED");
  } finally {
    await con.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
