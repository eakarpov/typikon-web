import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
async function main() {
    const [{ parseZnamen }, { normalizeNeumes, parseNeumeGroup }, { getMeasuredNotes }] = await Promise.all([import("@znamenica/kruczie/formats/znamen"), import("@znamenica/kruczie"), import("@znamenica/kruczie/melody")]);
    const root = join(process.cwd(), "data/chant-corpus/znamen-v1");
    const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
    const targets = new Map<string, { neumes: string; hits: number; safeHits: number; safeRejectedHits: number; examples: object[]; unsafeExamples: object[] }>();
    for (const kind of ["pitched", "unpitched"]) {
        const raw = await readFile(join(process.cwd(), `src/lib/kruczie/fixtures/w20g1-${kind}.txt`), "utf8");
        for (const block of parseZnamen(raw).value!.blocks) for (const neumes of block.notation?.trim().split(/\s+/u) ?? []) {
            const key = normalizeNeumes(neumes);
            if (!targets.has(key)) targets.set(key, { neumes, hits: 0, safeHits: 0, safeRejectedHits: 0, examples: [], unsafeExamples: [] });
        }
    }
    for (const [recordIndex, record] of manifest.records.entries()) {
        if (recordIndex % 500 === 0) console.log(`Проверено записей: ${recordIndex}/${manifest.records.length}`);
        if (record.notationKind !== "double") continue;
        const raw = await readFile(join(root, record.rawPath), "utf8");
        if (createHash("sha256").update(raw).digest("hex") !== record.sha256) throw new Error(`Checksum mismatch: ${record.id}`);
        const file = parseZnamen(raw).value;
        for (const [blockIndex, block] of file?.blocks.entries() ?? []) {
            const neumes = block.notation?.trim().split(/\s+/u).filter(Boolean) ?? [], notes = block.melody?.trim().split(/\s+/u).filter(Boolean) ?? [];
            const valid = neumes.map((neume, i) => {
                const music = notes[i] ? getMeasuredNotes(notes[i]) : undefined;
                return neume.split(/~~/u).every(group => parseNeumeGroup(group).value?.recognized) && !!music?.value?.length && !music?.diagnostics.some(d => d.severity === "error");
            });
            const originallyRejected = !block.aligned || valid.some(v => !v) || neumes.length !== notes.length;
            for (const [position, neume] of neumes.entries()) {
                const target = targets.get(normalizeNeumes(neume)); if (!target) continue;
                target.hits++;
                const safe = neumes.length === notes.length && !!notes.length && valid[position];
                if (safe) { target.safeHits++; if (originallyRejected) target.safeRejectedHits++; }
                const example = { witnessId: record.id, sourceId: record.sourceId, workId: record.chantId, tone: record.tone, toneEvidence: record.toneEvidence, url: record.url, rawPath: record.rawPath, sha256: record.sha256, block: blockIndex, position, neumes: neume, notes: notes[position] ?? null, originallyRejected, musicalAlignment: neumes.length === notes.length, textAlignment: block.aligned, safe };
                const examples = safe ? target.examples : target.unsafeExamples;
                if (examples.length < 30) examples.push(example);
            }
        }
    }
    const absent = [...targets.values()].filter(group => !group.hits).map(group => group.neumes);
    const bookHits: Record<string, { sourceId: string; line: number; url: string; sha256: string; hasNotesInBlock: boolean }[]> = Object.fromEntries(absent.map(raw => [raw, []]));
    for (const book of manifest.books) {
        const bytes = await readFile(join(root, book.rawPath));
        if (createHash("sha256").update(bytes).digest("hex") !== book.sha256) throw new Error(`Book checksum mismatch: ${book.sourceId}`);
        const decoded = new TextDecoder("windows-1251", { fatal: true }).decode(bytes);
        // %код is a work boundary. Parsing bounded works avoids quadratic whole-book scans.
        const boundaries = [0, ...[...decoded.matchAll(/^%код(?=[ \t\r\n]|$)/gmu)].map(match => match.index!).filter(offset => offset > 0), decoded.length];
        for (let work = 0; work < boundaries.length - 1; work++) {
            const start = boundaries[work], section = decoded.slice(start, boundaries[work + 1]);
            const bookFile = parseZnamen(section).value;
            for (const block of bookFile?.blocks ?? []) {
                const groups = block.notation?.trim().split(/\s+/u).map(normalizeNeumes) ?? [];
                for (const raw of absent) if (groups.includes(normalizeNeumes(raw))) bookHits[raw].push({
                    sourceId: book.sourceId, line: decoded.slice(0, start + block.range.start).split("\n").length,
                    url: book.url, sha256: book.sha256, hasNotesInBlock: block.melody !== undefined,
                });
            }
        }
        console.log(`Проверена книга: ${book.sourceId}`);
    }
    const [{ createBuiltinCatalog }, { createBuiltinNgramIndex }, { getNgramRealizations, getNgramFallbacks }, { translatePhrase }] = await Promise.all([
        import("@znamenica/kruczie/data"), import("@znamenica/kruczie/ngrams/data"), import("@znamenica/kruczie/ngrams"), import("@znamenica/kruczie"),
    ]);
    const catalog = createBuiltinCatalog(), index = createBuiltinNgramIndex();
    const context = { tradition: "znamenny" as const, tone: 2 as const };
    const coverage = [];
    for (const kind of ["pitched", "unpitched"]) {
        const file = parseZnamen(await readFile(join(process.cwd(), `src/lib/kruczie/fixtures/w20g1-${kind}.txt`), "utf8")).value!;
        const cells = file.document.pages.flatMap(page => page.paragraphs.flatMap(paragraph => paragraph.elements.filter(e => e.kind === "syllable")));
        const groups = new Map<string, { catalog: boolean; strict: boolean; fallback: boolean }>();
        for (const cell of cells) {
            if (cell.kind !== "syllable" || !cell.notation || groups.has(cell.notation.raw)) continue;
            const raw = cell.notation.raw;
            const legacy = translatePhrase(catalog, [cell], { direction: "to-notes", ...context, maxCandidates: 3, maxSteps: 2500 }).candidates.length > 0;
            const strict = getNgramRealizations(index, raw, context).length > 0;
            groups.set(raw, { catalog: legacy, strict: legacy || strict, fallback: legacy || strict || getNgramFallbacks(index, raw, context).length > 0 });
        }
        const count = (field: "catalog" | "strict" | "fallback") => cells.filter(c => c.kind === "syllable" && c.notation && groups.get(c.notation.raw)?.[field]).length;
        coverage.push({ fixture: `w20g1-${kind}.txt`, totalPositions: cells.length, uniqueGroups: groups.size, catalogCovered: count("catalog"), strictCovered: count("strict"), withFallbackCovered: count("fallback"), unresolvedGroups: [...groups].filter(([, value]) => !value.fallback).map(([raw]) => raw) });
    }
    const result = { schemaVersion: 1, corpusVersion: "znamen-2026-10-27-v2", scope: "Exact normalized groups from both w20g1 fixtures; all archived double-notation witnesses, including blocks excluded by the v1 whole-block check. Counts are raw occurrences, not deduplicated training frequencies.", coverage: { context, modelVersion: index.model.version, fixtures: coverage }, groups: [...targets.values()], absentGroupsBookScan: { scope: "Exact normalized group match in parsed musical blocks of all archived source books, including single notation; no musical mapping inferred", hits: bookHits } };
    await writeFile(join(root, "neume-audit.json"), JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify({ groups: result.groups.length, absent: result.groups.filter(g => !g.hits).map(g => g.neumes), recoverableFromRejected: result.groups.filter(g => g.safeRejectedHits).length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
