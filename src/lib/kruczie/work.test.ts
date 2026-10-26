import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inspectWork, translateWorkBlock, exportWork, saveBlockCells, saveBlockLayers, draftsOf } from "./work";

const source = "\uFEFF%код w10g1\r\n%текст Вечерня\r\n\r\n%з Э: пК: мК: сТ. мК:\r\n%т Ве-че-рнi-я на-\r\n\r\n%л.9\r\n%н г1\r\n%т и=\r\n%будущее сохранить\r\n";

test("полный исходник сохраняет блоки, заголовки и певческие позиции", async () => {
    const view = await inspectWork(source);
    assert.equal(view.file.raw, source);
    assert.equal(view.blocks.length, 2);
    assert.equal(view.blocks[0].cells.length, 5);
    assert.deepEqual(view.blocks[0].cells.map(c => c.syllable.text.raw), ["Ве", "че", "рнi", "я", "на"]);
    assert.ok(view.blocks[1].heading.includes("%л.9"));
    assert.equal(view.blocks[1].cells[0].syllable.text.raw, "и=");
    assert.equal(await exportWork(source, {}), source);
});
test("перевод фразы сохраняет все слоги и их границы при экспорте произведения", async () => {
    const view = await inspectWork(source);
    const result = await translateWorkBlock(view, 0, { direction: "to-notes", tradition: "znamenny" });
    assert.ok(result.candidates.length);
    const candidate = result.candidates[0];
    assert.deepEqual(candidate.syllables.map(s => s.text), view.blocks[0].cells.map(c => c.syllable.text));
    assert.equal(candidate.syllables.length, 5);
    const exported = await exportWork(source, { 0: candidate });
    assert.ok(exported.startsWith("\uFEFF%код w10g1\r\n"));
    assert.ok(exported.endsWith("%л.9\r\n%н г1\r\n%т и=\r\n%будущее сохранить\r\n"));
    assert.ok(exported.includes("%т Ве-че-рнi-я на-\r\n"));
    assert.equal((await inspectWork(exported)).blocks.length, 2);
});
test("назначение слога и нескольких крюков одной позиции явно сохраняется", async () => {
    const raw = "%текст Заголовок\n%з гТ. гТ.\n%т а-б\n\n%н г1\n%т в\n";
    const view = await inspectWork(raw), draft = draftsOf(view.blocks[0].cells);
    draft[0].text = "но'";
    const changed = await saveBlockCells(raw, 0, draft, true, false);
    const reparsed = await inspectWork(changed);
    assert.equal(reparsed.blocks[0].cells[0].syllable.text.raw, "но'");
    assert.equal(reparsed.blocks[0].cells[1].syllable.text.raw, "б");
    assert.ok(changed.endsWith("%н г1\n%т в\n"));
    const grouped = await saveBlockLayers(raw, 0, { notation: "гТ.~~гТ. гТ.", text: "а-б" });
    assert.equal((await inspectWork(grouped)).blocks[0].cells.length, 2);
});
test("несовпавшие слои не склеиваются и исправляются только явным назначением", async () => {
    const raw = "%текст Читок\n%н г... г1 н1\n%т а-б\n\n%н с1\n%т в\n";
    const view = await inspectWork(raw);
    assert.equal(view.blocks[0].cells.length, 0);
    assert.equal((await translateWorkBlock(view, 0, { direction: "to-neumes", tradition: "znamenny" })).status, "unaligned");
    const corrected = await saveBlockLayers(raw, 0, { melody: "г... г1 н1", text: "а-_-б" });
    const repaired = await inspectWork(corrected);
    assert.equal(repaired.blocks[0].cells.length, 3);
    assert.equal(repaired.blocks[0].cells[1].syllable.text.raw, "");
    assert.ok(corrected.endsWith("%н с1\n%т в\n"));
    assert.equal(repaired.blocks[0].cells[0].syllable.melody!.events![0].kind, "reciting");
    await assert.rejects(() => saveBlockLayers(raw, 0, { melody: "г1 н1", text: "а" }));
});
test("один неразобранный блок не мешает поиску в остальных", async () => {
    const raw = "%н г1 н1\n%т а\n\n" + source.replace(/^\uFEFF/u, "");
    const view = await inspectWork(raw);
    assert.equal((await translateWorkBlock(view, 0, { direction: "to-notes", tradition: "znamenny" })).status, "unaligned");
    assert.ok((await translateWorkBlock(view, 1, { direction: "to-notes", tradition: "znamenny" })).candidates.length);
});
test("все присланные форматы импортируются без потери исходника и текстовых позиций", async () => {
    const { tokenizeUnderlay } = await import("@znamenica/kruczie/formats/znamen");
    for (const name of ["double", "neumes", "notes", "recitation"]) {
        const raw = readFileSync(join(process.cwd(), "src/lib/kruczie/fixtures", `${name}.txt`), "utf8");
        const view = await inspectWork(raw);
        assert.equal(await exportWork(raw, {}), raw);
        assert.ok(view.blocks.length);
        if (name === "double") assert.equal(view.headerTone, 1);
        view.blocks.forEach((row, i) => {
            if (view.file.blocks[i].aligned) assert.deepEqual(row.cells.map(c => c.syllable.text.raw), tokenizeUnderlay(view.file.blocks[i].text!).map(t => t.raw));
            else assert.equal(row.cells.length, 0);
        });
    }
});
