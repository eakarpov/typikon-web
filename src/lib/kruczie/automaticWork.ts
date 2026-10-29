import { loadNgramApi } from "./corpus";
import { compareCorpusRankings } from "./sequenceRanking";
import type { CorpusRanking } from "./corpus/types";
import type { Direction } from "./model";
import type { WorkCell, WorkResult, WorkView } from "./work";
import { createNoteFill, exportCompletedWork } from "./workDraft";

export interface AutomaticWorkBlock {
    cells: WorkCell[];
    ranking?: CorpusRanking;
    tied: number;
    truncated: boolean;
}
export interface AutomaticWork {
    blocks: AutomaticWorkBlock[];
    gaps: { block: number; position: number | null; reason: string }[];
    total: number;
    covered: number;
    notes: string;
    raw?: string;
}

/** Pick one stable winner per block, independently of the user's manual draft. */
export async function assembleAutomaticWork(view: WorkView, results: Readonly<Record<number, WorkResult>>, direction: Direction): Promise<AutomaticWork> {
    await loadNgramApi();
    const { parseMelody } = await import("@znamenica/kruczie/melody");
    const output: AutomaticWork = { blocks: [], gaps: [], total: 0, covered: 0, notes: "" };
    for (const [block, row] of view.blocks.entries()) {
        const result = results[block];
        const candidates = (result?.candidates ?? []).map((candidate, order) => ({ candidate, order }))
            .sort((a, b) => (a.candidate.ranking&&b.candidate.ranking?compareCorpusRankings(a.candidate.ranking,b.candidate.ranking):0) || a.order - b.order);
        const best = candidates[0]?.candidate;
        const recommendation = direction === "to-notes" ? result?.recommendation : undefined;
        const automatic: AutomaticWorkBlock = {
            cells: [], ranking: recommendation?.ranking ?? best?.ranking,
            tied: recommendation?.tied ?? (best ? candidates.filter(c => (c.candidate.ranking&&best.ranking?compareCorpusRankings(c.candidate.ranking,best.ranking)===0:true)).length : 1),
            truncated: !!(result?.truncated || recommendation?.truncated),
        };
        output.blocks.push(automatic);
        output.total += row.cells.length;
        if (!view.file.blocks[block].aligned || !row.cells.length) {
            output.gaps.push({ block, position: null, reason: "Не определена слоговая привязка блока; исходник сохранён." });
            continue;
        }
        for (const [position, original] of row.cells.entries()) {
            const fromCandidate = best?.cells.length === row.cells.length ? best.cells[position] : undefined;
            let cell: WorkCell = { ...(fromCandidate ?? original), syllable: { ...(fromCandidate?.syllable ?? original.syllable), text: original.syllable.text } };
            if (direction === "to-notes") {
                const notes = original.syllable.melody?.raw ?? (recommendation ? recommendation.notes[position] : fromCandidate?.syllable.melody?.raw ?? result?.positions?.find(p => p.index === position)?.notes[0]);
                cell = { ...original, syllable: { ...original.syllable, ...(notes ? { melody: parseMelody(notes).value! } : {}) } };
            }
            automatic.cells.push(cell);
            let reason = !cell.syllable.notation ? "Крюковый слой не найден." : !cell.syllable.melody ? "Нет известного нотного соответствия." : "";
            if (!reason) {
                try { await createNoteFill(cell.syllable.melody!.raw, "catalog"); }
                catch { reason = "Нотная запись не содержит полностью измеренную мелодию."; }
            }
            if (reason) output.gaps.push({ block, position, reason });
            else output.covered++;
        }
    }
    if (!output.gaps.length && output.covered === output.total && output.total > 0) {
        output.raw = await exportCompletedWork(view, output.blocks.map(block => block.cells));
        output.notes = output.blocks.flatMap(block => block.cells.map(cell => cell.syllable.melody!.raw)).join(" ");
    }
    return output;
}
