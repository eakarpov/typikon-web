import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fontkit from "@pdf-lib/fontkit";

test("Old Standard's Church Slavonic locale substitutes ordinary а/е; civil CSS overrides glyph locale", () => {
    const font = fontkit.create(fs.readFileSync("public/fonts/OldStandard-Regular.woff2")) as any;
    const glyphs = (locale: string) => font.layout("ае", [], "cyrl", locale).glyphs.map((g: { id: number }) => g.id);
    assert.notDeepEqual(glyphs("CSL"), glyphs("RUS"));
    assert.deepEqual(font.layout("ае", { locl: false }, "cyrl", "CSL").glyphs.map((g: { id: number }) => g.id), glyphs("RUS"));
    const css = fs.readFileSync("src/styles/globals.css", "utf8");
    assert.match(css, /\.reading-text\.font-serif\s*\{\s*font-feature-settings:\s*"locl" 0/);
});
