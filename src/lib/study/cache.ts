const bucket = (owner: string) => "study:" + owner;
const writers = new Map<string, Promise<void>>();
let epoch = 0;
async function cacheKey(key: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  return (
    "/__study/" +
    key.split(":")[0].split("?")[0] +
    "-" +
    Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("")
  );
}
export async function readCache<T>(
  owner: string,
  key: string,
): Promise<T | null> {
  try {
    await writers.get(owner);
    const r = await (
      await caches.open(bucket(owner))
    ).match(await cacheKey(key));
    return r ? await r.json() : null;
  } catch {
    return null;
  }
}
export async function writeCache(owner: string, key: string, value: unknown) {
  const currentEpoch = epoch,
    previous = writers.get(owner) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      if (currentEpoch !== epoch && owner !== "guest") return;
      const c = await caches.open(bucket(owner));
      await c.put(
        await cacheKey(key),
        new Response(JSON.stringify(value), {
          headers: { "Content-Type": "application/json" },
        }),
      );
      if (currentEpoch !== epoch && owner !== "guest")
        await caches.delete(bucket(owner));
    });
  writers.set(owner, next);
  try {
    await next;
  } finally {
    if (writers.get(owner) === next) writers.delete(owner);
  }
}
export async function clearPrivateStudy() {
  localStorage.removeItem("study:owner");
  window.dispatchEvent(new Event("study-owner-changed"));
  await Promise.allSettled([...writers.values()]);
  epoch++;
  if (typeof caches !== "undefined")
    for (const name of await caches.keys())
      if (name.startsWith("study:user:")) {
        const c = await caches.open(name),
          key = await cacheKey("personal"),
          response = await c.match(key);
        const local = response ? await response.clone().json() : null;
        const pending =
          (Array.isArray(local?.queue) && local.queue.length > 0) ||
          (Array.isArray(local?.conflicts) && local.conflicts.length > 0);
        await caches.delete(name);
        // A snapshot with unfinished work remains in its original account bucket.
        if (pending && response)
          await (await caches.open(name)).put(key, response);
      }
  for (const key of Object.keys(localStorage))
    if (key.startsWith("study:user:")) localStorage.removeItem(key);
  localStorage.removeItem("study:owner");
}
export async function savedMaterials(owner: string) {
  await writers.get(owner);
  const c = await caches.open(bucket(owner));
  const keys = (await c.keys()).filter((k) =>
    new URL(k.url).pathname.includes("/__study/material-"),
  );
  const out = [];
  for (const k of keys) {
    const r = await c.match(k);
    if (r) {
      const m = await r.json();
      out.push({
        title: m.title,
        target: m.target,
        missing: m.missing,
        bytes: new TextEncoder().encode(JSON.stringify(m)).length,
      });
    }
  }
  return out;
}
