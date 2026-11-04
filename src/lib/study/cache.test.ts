import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { writeCache, readCache, clearPrivateStudy } from "./cache";
test("logout keeps unfinished work in its owner bucket and removes downloaded private cache", async () => {
  const buckets = new Map<string, Map<string, Response>>();
  Object.assign(globalThis, {
    window: new EventTarget(),
    localStorage: { removeItem: (_key: string) => {} },
    caches: {
      async keys() {
        return [...buckets.keys()];
      },
      async delete(name: string) {
        return buckets.delete(name);
      },
      async open(name: string) {
        if (!buckets.has(name)) buckets.set(name, new Map());
        const map = buckets.get(name)!;
        return {
          async put(k: string, v: Response) {
            map.set(k, v.clone());
          },
          async match(k: string) {
            return map.get(k)?.clone();
          },
          async keys() {
            return [...map.keys()].map(
              (k) => new Request("http://fixture" + k),
            );
          },
        };
      },
    },
  });
  const pending = {
    state: { records: [{ id: "note", note: "unsent" }] },
    queue: [{ opId: "operation" }],
    conflicts: [],
  };
  const saving = writeCache("user:alice", "personal", pending);
  await writeCache("user:alice", "material:source", { text: "download" });
  await writeCache("user:bob", "personal", {
    state: { records: [] },
    queue: [],
    conflicts: [],
  });
  await clearPrivateStudy();
  await saving;
  assert.deepEqual(await readCache("user:alice", "personal"), pending);
  assert.equal(await readCache("user:alice", "material:source"), null);
  assert.equal(await readCache("guest", "personal"), null);
  assert.equal(await readCache("user:bob", "personal"), null);
  await writeCache("user:alice", "personal", {
    state: { records: [] },
    queue: [],
    conflicts: [],
  });
  await clearPrivateStudy();
  assert.equal(await readCache("user:alice", "personal"), null);
});
