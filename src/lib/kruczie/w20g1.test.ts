import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { looksLikeEscapedZnamen, unescapeZnamenPaste } from "./transport";
import { importZnamenText } from "./znamen";
import { inspectWork, exportWork, saveBlockCells, draftsOf, translateWorkBlock, partialWorkCells } from "./work";
const fixture = (name: string) => readFileSync(join(process.cwd(), "src/lib/kruczie/fixtures", name), "utf8");

for (const [name, blocks, positions] of [["pitched", 10, 88], ["unpitched", 9, 86]] as const) {
    test(`w20g1 ${name}: явная очистка вставки восстанавливает слоговую привязку`, async () => {
        const pasted = fixture(`w20g1-${name}-pasted.txt`);
        assert.ok(looksLikeEscapedZnamen(pasted));
        await assert.rejects(() => importZnamenText(pasted), /Markdown/u);
        const raw = unescapeZnamenPaste(pasted);
        assert.equal(raw, fixture(`w20g1-${name}.txt`));
        const view = await inspectWork(raw);
        assert.equal(view.blocks.length, blocks);
        assert.ok(view.file.blocks.every(b => b.aligned));
        assert.equal(view.blocks.reduce((n, b) => n + b.cells.length, 0), positions);
        assert.equal(view.file.diagnostics.filter(d => d.severity === "error").length, 0);
        assert.ok(view.header.includes("%код w20g1"));
        assert.match(view.header, /2\./u);
        assert.equal(view.headerTone, 2);
        assert.ok(view.footer.includes("%Разница"));
        assert.ok(!view.blocks.some(b => b.cells.some(c => c.syllable.text.raw.includes("Первовё'чному"))));
        assert.equal(await exportWork(raw, {}), raw);
        const drafts = draftsOf(view.blocks[0].cells);
        drafts[0].text = "Тест";
        const updated = await inspectWork(await saveBlockCells(raw, 0, drafts, true, false));
        assert.equal(updated.header, view.header);
        assert.equal(updated.footer, view.footer);
        assert.equal(updated.blocks[0].cells[0].syllable.text.raw, "Тест");
    });
}
test("очистка чатов не применяется к настоящей палке крюковой записи автоматически", () => {
    assert.equal(looksLikeEscapedZnamen("%код test\n%з Т \\\n%т а-б\n"), false);
});
test("w20g1: отсутствие полного развода отделяется от синтаксических ошибок", async () => {
    const view = await inspectWork(fixture("w20g1-pitched.txt"));
    const result = await translateWorkBlock(view, 0, { direction: "to-notes", tradition: "znamenny", tone: 2 });
    assert.equal(result.status, "untranslated");
    assert.ok(result.positions?.length);
    assert.ok(!result.diagnostics.some(d => d.code === "UNKNOWN_NEUME" || d.code === "LAYER_ALIGNMENT"));
    assert.ok(!result.diagnostics.some(d => d.code === "UNCOVERED_INPUT"));
    const missing = view.blocks[0].cells.flatMap((_, position) => result.positions?.some(p => p.index === position && p.notes.length) ? [] : [position]);
    assert.deepEqual(result.diagnostics.find(d => d.code === "MUSICAL_GAPS")?.details?.positions ?? [], missing);
});

test("w20g1: частичный стан сохраняет все девять позиций и показывает пропуски", async () => {
    const raw = fixture("w20g1-pitched.txt"), view = await inspectWork(raw);
    const result = await translateWorkBlock(view, 0, { direction: "to-notes", tradition: "znamenny", tone: 2 });
    const before = JSON.stringify(view.blocks[0]);
    const { parseMelody } = await import("@znamenica/kruczie/melody");
    assert.ok(result.positions?.find(p=>p.index===0)?.notes.includes("м2"));
    assert.ok(result.recommendation?.ranking.evidence.some(e=>e.order>=2));
    assert.equal(result.recommendation?.notes.length,9);
    // Test layout independently of growing corpus coverage: retain two deliberate gaps.
    const controlled = { ...result, positions: result.positions?.filter(p=>p.index!==3 && p.index!==4).map(p=>p.index===0 ? {...p,notes:["м2"],melodies:[parseMelody("м2").value!]} : p) };
    const cells = partialWorkCells(view.blocks[0], controlled);
    assert.equal(cells.length, 9);
    assert.equal(cells[0].syllable.melody?.raw, "м2");
    assert.equal(cells[3].syllable.melody, undefined);
    assert.equal(cells[4].syllable.melody, undefined);
    assert.equal(cells[3].partial, true);
    assert.equal(cells[4].partial, true);
    assert.ok((cells[1].melodyOptions?.length ?? 0) >= 3);
    assert.equal(cells[1].syllable.melody, undefined); // No arbitrary choice of an ambiguous melody.
    const chosen = partialWorkCells(view.blocks[0], controlled, { 1: 1 });
    assert.equal(chosen[1].syllable.melody?.raw, cells[1].melodyOptions![1].raw);
    assert.equal(chosen[3].syllable.melody, undefined);
    assert.equal(JSON.stringify(view.blocks[0]), before);
    assert.equal(await exportWork(raw, {}), raw);
    const noCoverage = partialWorkCells(view.blocks[0], { ...result, positions: [] });
    assert.ok(noCoverage.every(cell => cell.partial && !cell.syllable.melody));
});
