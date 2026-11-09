import test from "node:test";
import assert from "node:assert/strict";
import { onlineSessionFilter, probeService } from "./status";

test("online means recent activity AND an unexpired session", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    assert.deepEqual(onlineSessionFilter(now), { expiresAt: { $gt: now }, lastSeenAt: { $gte: new Date("2026-11-09T11:55:00Z") } });
});
test("404 and unrelated HTTP servers are not healthy service routes", async () => {
    const original = global.fetch;
    try {
        global.fetch = async () => new Response(null, { status: 404, headers: { allow: "POST" } });
        assert.equal(await probeService("http://localhost/pdf", "POST"), false);
        global.fetch = async () => new Response(null, { status: 200, headers: { allow: "GET, HEAD" } });
        assert.equal(await probeService("http://localhost/pdf", "POST"), false);
        assert.equal(await probeService("http://localhost/meta", "GET"), true);
        global.fetch = async () => new Response(null, { status: 204, headers: { "access-control-allow-methods": "GET,HEAD,PUT,PATCH,POST,DELETE" } });
        assert.equal(await probeService("http://localhost/pdf", "POST"), true);
        global.fetch = async () => { throw new Error("offline"); };
        assert.equal(await probeService("http://localhost/meta", "GET"), false);
    } finally { global.fetch = original; }
});
