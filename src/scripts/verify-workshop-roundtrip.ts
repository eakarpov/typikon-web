// Verify artifacts captured through the actual browser UI; no database access.
// node --import tsx src/scripts/verify-workshop-roundtrip.ts /tmp > /tmp/workshop-roundtrip-review.json
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { inspectWork, type WorkView } from "@/lib/kruczie/work";
import { exportCompletedWork } from "@/lib/kruczie/workDraft";
import { createPlaybackPlan } from "@/lib/kruczie/playback";

const directory = process.argv[2] ?? "/tmp";
const read = (name: string) => readFileSync(join(directory, name), "utf8");
const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");
const syllables = (view: WorkView) => view.blocks.map(b => b.cells.map(c => ({
    text: c.syllable.text.raw, separator: c.syllable.text.separator,
})));
const rawBlock = (view: WorkView, index: number) => {
    const range = view.file.blocks[index].range;
    return view.file.raw.slice(range.start, range.end);
};
const music = (view: WorkView) => view.blocks.flatMap(b => b.cells.map(c => c.syllable.melody?.raw ?? "")).join(" ");

async function main() {
    const input = read("workshop-roundtrip-input.txt");
    const exported = read("workshop-roundtrip-export.txt");
    const repeated = read("workshop-roundtrip-reexport.txt");
    const original = await inspectWork(input);
    const restored = await inspectWork(repeated);
    assert.equal(exported, input, "Manual export changed the input document");
    assert.equal(repeated, input, "Repeated import/export changed the document");
    assert.equal(original.blocks.length, 8);
    assert.equal(original.blocks.flatMap(b => b.cells).length, 50);
    assert.deepEqual(syllables(restored), syllables(original));
    assert.deepEqual(restored.file.blocks.map(b => [b.notation, b.melody, b.text]),
        original.file.blocks.map(b => [b.notation, b.melody, b.text]));
    const plan96 = await createPlaybackPlan(music(original), 96);
    const plan132 = await createPlaybackPlan(music(original), 132);
    assert.ok(plan96.value && plan132.value);
    assert.deepEqual(await createPlaybackPlan(music(restored), 96), plan96);
    assert.ok(Math.abs(plan96.value.duration / plan132.value.duration - 132 / 96) < 1e-9);

    const autoInput = read("workshop-auto-input.txt");
    const autoExport = read("workshop-auto-export.txt");
    const autoRepeat = read("workshop-auto-reexport.txt");
    const before = await inspectWork(autoInput);
    const after = await inspectWork(autoExport);
    assert.equal(autoRepeat, autoExport, "Re-export changed the automatic result");
    assert.equal(after.blocks.length, 3);
    assert.equal(after.blocks.flatMap(b => b.cells).length, 8);
    assert.ok(after.file.blocks.every(b => b.aligned && b.notation && b.melody));
    assert.deepEqual(syllables(after), syllables(before));
    assert.deepEqual(after.file.blocks.map(b => [b.notation, b.text]), before.file.blocks.map(b => [b.notation, b.text]));
    assert.equal(after.header, before.header);
    assert.equal(after.footer, before.footer);
    assert.equal(rawBlock(after, 2), rawBlock(before, 2), "Existing musical block was overwritten");
    let notes = 0;
    const withoutAddedNotes = autoExport.split(/(?<=\n)/).filter(line => !line.startsWith("%н ") || ++notes > 2).join("");
    assert.equal(withoutAddedNotes, autoInput, "Changes outside the two new melody lines");
    const automaticPlan = await createPlaybackPlan(music(after), 96);
    assert.ok(automaticPlan.value);
    // The musical library also preserves BOM/CRLF, before a browser textarea normalizes CRLF.
    const crlf = input.replace(/\n/g, "\r\n");
    const crlfView = await inspectWork(crlf);
    assert.equal(await exportCompletedWork(crlfView, crlfView.blocks.map(b => b.cells)), crlf);
    const browser = JSON.parse(read("workshop-browser-evidence.json"));
    assert.deepEqual(browser.consoleErrors, []);
    assert.ok(browser.roundtrip.browserInputExact && browser.roundtrip.clipboardExact && browser.roundtrip.repeatExportExact);
    assert.ok(browser.automatic.repeatExportExact);
    const check = (name: string) => {
        const found = browser.playback.find((c: { case: string }) => c.case === name);
        assert.ok(found, `Missing browser check: ${name}`);
        return found;
    };
    assert.ok(check("start-whole").stopButton);
    assert.ok(check("cursor-advances").cursor.length > 0);
    for (const name of ["stop", "tempo-stops-playback", "natural-completion-block8"]) {
        assert.ok(check(name).playButton);
        assert.equal(check(name).highlights, 0);
    }
    assert.ok(check("whole-replaces-block").wholeStop && check("whole-replaces-block").blockPlay);
    for (const name of ["export-stops-playback", "automatic-export-stops-playback", "leave-work"]) {
        assert.equal(check(name).highlights, 0);
    }
    assert.equal(check("leave-work").stopButtons, 0);
    assert.ok(check("automatic-start").stopButton);
    assert.ok(browser.incomplete.manualExportBlocked && browser.incomplete.wholePlaybackBlocked
        && browser.incomplete.automaticExportBlocked && browser.incomplete.automaticPlaybackBlocked);
    console.log(JSON.stringify({
        validatedAt: new Date().toISOString(), status: "passed", scope: "Local browser and captured UI artifacts; no production validation",
        browser,
        roundtrip: {
            blocks: 8, syllablePositions: 50, exactInputAndBothExports: true,
            inputSha256: hash(input), exportSha256: hash(exported), repeatExportSha256: hash(repeated),
            allLayersAndSyllableSeparators: true, BOMPreserved: input.startsWith("\uFEFF"),
            CRLF: "Browser textarea normalizes CRLF to LF; comparison starts at its input value. Library BOM/CRLF export checked separately and passed.",
            playback: { tones: plan96.value.tones.length, duration96: plan96.value.duration,
                duration132: plan132.value.duration, repeatImportPlanIdentical: true },
        },
        automatic: {
            blocks: 3, syllablePositions: 8, addedMelodyLayers: 2, inputSha256: hash(autoInput),
            exportSha256: hash(autoExport), repeatExportSha256: hash(autoRepeat),
            existingBlockExact: true, onlyTwoMelodyLinesAdded: true, headerFooterAndSyllablesExact: true,
            playbackTones: automaticPlan.value.tones.length,
        },
        limits: ["Playback verified through browser controls, advancing note cursor and absence of playback errors; acoustic output was not assessed by ear.",
            "This verifies software behavior and preservation of input, not historical correctness of automatic musical choices."],
    }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
