import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

test("cache version middleware leaves no-store policy to route, never echoes request cache headers", () => {
    const response = middleware(new NextRequest("https://www.typikon.info/api/cache-version", {
        headers: { "cache-control": "no-cache", "x-typikon-app": "2.3.2+12" },
    }));
    assert.equal(response.headers.get("x-middleware-next"), "1");
    assert.equal(response.headers.get("cache-control"), null);
    assert.equal(response.headers.get("x-typikon-app"), null);
});
