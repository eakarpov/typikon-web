import type { CorpusPosition, CorpusSample } from "./types";
import type { ZnamenFile } from "@znamenica/kruczie/formats/znamen";

/** Musical layers must agree independently; a text mismatch never supplies guessed syllables. */
export async function extractTrainingSegments(file: ZnamenFile, witnessId: string) {
    const [{ parseNeumeGroup }, { getMeasuredNotes }, { tokenizeUnderlay }] = await Promise.all([
        import("@znamenica/kruczie"), import("@znamenica/kruczie/melody"), import("@znamenica/kruczie/formats/znamen"),
    ]);
    const samples: CorpusSample[] = [], rejected: { witnessId: string; block: number; reason: string }[] = [];
    let rejectedPositions = 0, recoveredBlocks = 0, recoveredPositions = 0;
    for (const [blockIndex, block] of file.blocks.entries()) {
        const neumes = block.notation?.trim().split(/\s+/u).filter(Boolean) ?? [];
        const notes = block.melody?.trim().split(/\s+/u).filter(Boolean) ?? [];
        const text = block.text === undefined ? [] : tokenizeUnderlay(block.text);
        if (!neumes.length || neumes.length !== notes.length) {
            rejected.push({ witnessId, block: blockIndex, reason: "unaligned-or-missing-musical-layer" });
            rejectedPositions += Math.max(neumes.length, notes.length);
            continue;
        }
        const positions: (CorpusPosition | null)[] = neumes.map((raw, position) => {
            const measured = getMeasuredNotes(notes[position]);
            if (!measured.value?.length || measured.diagnostics.some(d => d.severity === "error") || raw.split(/~~/u).some(group => !parseNeumeGroup(group).value?.recognized)) return null;
            return { position, neumes: raw, notes: measured.value.map(n => n.raw).join(""), phraseEnd: /[\\/]/u.test(notes[position]), text: text.length === neumes.length ? text[position].raw : "" };
        });
        const missing = positions.filter(p => p === null).length;
        const recovery = text.length !== neumes.length ? "music-only" as const : missing ? "aligned-segment" as const : undefined;
        if (recovery) {
            rejected.push({ witnessId, block: blockIndex, reason: recovery === "music-only" ? "text-alignment-unresolved" : "unreadable-or-unmeasured-position" });
            rejectedPositions += missing;
            if (positions.some(Boolean)) { recoveredBlocks++; recoveredPositions += positions.length - missing; }
        }
        let segment: CorpusPosition[] = [];
        const flush = () => { if (segment.length) samples.push({ witnessId, block: blockIndex, positions: segment, ...(recovery ? { recovery } : {}) }); segment = []; };
        for (const position of positions) { if (position) segment.push(position); else flush(); }
        flush();
    }
    return { samples, rejected, rejectedPositions, recoveredBlocks, recoveredPositions };
}
