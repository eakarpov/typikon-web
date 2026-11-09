import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { settingsBootScript, defaultValues } from "./reading";
import { sanitizeReadingValues } from "./account";

const boot = (stored: Record<string, string>) => {
    const css: Record<string, string> = {};
    const writes: string[] = [];
    vm.runInNewContext(settingsBootScript, {
        localStorage: { getItem: (key: string) => stored[key] ?? null },
        document: { documentElement: { style: { setProperty: (key: string, value: string) => { css[key] = value; } } }, write: (html: string) => writes.push(html) },
    });
    return { css, writes };
};

test("browser settings apply before paint without account requests", () => {
    const result = boot({ "typikon-background-color": "#111111" });
    assert.equal(result.css["--page-bg"], "#111111");
    assert.deepEqual(result.writes, []);
});

test("account settings override browser cache and load a blocking script", () => {
    const result = boot({ "typikon-background-color": "#111111", "typikon-reading-source": "account",
        "typikon-account-reading": JSON.stringify({ background: "#222222" }) });
    assert.equal(result.css["--page-bg"], "#222222");
    assert.deepEqual(result.writes, ['<script src="/api/reading-settings/boot"></script>']);
});

test("a corrupt account snapshot still fetches current account settings", () => {
    assert.equal(boot({ "typikon-reading-source": "account", "typikon-account-reading": "{" }).writes.length, 1);
});

test("account values cannot inject CSS, script, unknown fonts or options", () => {
    assert.deepEqual(sanitizeReadingValues({ background: '</script><script>alert(1)</script>',
        foreground: "red; background:url(https://example.org)", fontSize: "999rem", csFont: "evil", extra: "value" }), defaultValues());
    assert.equal(sanitizeReadingValues({ background: "#112233", fontSize: "1.5rem" }).background, "#112233");
});
