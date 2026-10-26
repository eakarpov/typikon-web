import type { CorpusRanking } from "./corpus/types";
import { builtinCorpusIndex } from "./corpus/builtin";
import { getCorpusRealizations, rankCorpusSequences, scoreCorpusSequence, suggestCorpusSequences } from "./corpus";
import type { Catalog, Diagnostic, Syllable, Tone, ChantTradition } from "@znamenica/kruczie";
import type { ZnamenFile, ZnamenEdit } from "@znamenica/kruczie/formats/znamen";
import type { Melody } from "@znamenica/kruczie/melody";
import type { Direction } from "./model";

export interface WorkCell { syllable: Syllable; unicode: string; textUnicode: string; melodyOptions?: readonly Melody[]; melodyRankings?: readonly CorpusRanking[]; partial?: boolean; fillOrigin?: "manual" | "catalog" }
export interface WorkBlock { index: number; cells: WorkCell[]; heading: string; diagnostics: readonly Diagnostic[] }
export interface WorkView { file: ZnamenFile; blocks: WorkBlock[]; header: string; footer: string; headerTone?: Tone }
export interface WorkCandidate { syllables: readonly Syllable[]; cells: WorkCell[]; notes: string; neumes: string; origins: string[]; preferred: boolean; ranking?: CorpusRanking }
export interface WorkResult {
    blockIndex: number;
    positions?: { index: number; notes: string[]; melodies: Melody[]; rankings?: CorpusRanking[] }[];
    recommendation?: { notes: (string | null)[]; ranking: CorpusRanking; truncated: boolean; tied?: number };
    candidates: WorkCandidate[];
    diagnostics: readonly Diagnostic[];
    truncated: boolean;
    status: "translated" | "untranslated" | "unaligned" | "missing-layer";
}
export interface WorkOptions { direction: Direction; tradition: ChantTradition; tone?: Tone; corpusSourceId?: string }
export interface CellDraft { notation: string; melody: string; text: string; separator: string }
let catalog: Catalog | undefined;

export async function inspectWork(raw: string): Promise<WorkView> {
    const { importZnamenText } = await import("./znamen");
    const { convertNeumes, parseMelody, unicodeSlavonic } = await import("@znamenica/kruczie");
    const file = await importZnamenText(raw);
    const header = raw.slice(0, file.blocks[0].range.start);
    const toneMatch = /Гласъ?[.,:\s]*([1-8])\b/iu.exec(header.replace(/[{}\\~'`^]/gu, ""));
    return { file, ...(toneMatch ? { headerTone: Number(toneMatch[1]) as Tone } : {}), header: raw.slice(0, file.blocks[0].range.start), footer: raw.slice(file.blocks.at(-1)!.range.end), blocks: file.blocks.map((block, index) => {
        const paragraph = file.document.pages[0]?.paragraphs[block.paragraphIndex];
        const before = index ? file.blocks[index - 1].range.end : 0;
        const heading = file.lines.filter(line => line.range.start >= before && line.range.end <= block.range.start && line.name && !["з", "н", "т"].includes(line.name))
            .map(line => line.name === "текст" || line.name === "Название" ? line.payload : line.raw.trim()).filter(Boolean).join(" · ");
        const cells = paragraph?.elements.filter((element): element is Syllable => element.kind === "syllable").map(syllable => ({
            syllable: { ...syllable, ...(syllable.melody ? { melody: parseMelody(syllable.melody.raw).value! } : {}) },
            textUnicode: unicodeSlavonic(syllable.text.raw),
            unicode: syllable.notation ? convertNeumes(syllable.notation.raw).value!.unicode : "",
        })) ?? [];
        return { index, cells, heading, diagnostics: file.diagnostics.filter(d => d.range && d.range.start < block.range.end && d.range.end > block.range.start) };
    }) };
}
export async function translateWorkBlock(view: WorkView, blockIndex: number, options: WorkOptions): Promise<WorkResult> {
    const row = view.blocks[blockIndex], block = view.file.blocks[blockIndex];
    if (!row || !block) throw new Error("Блок отсутствует в произведении.");
    const empty = (status: WorkResult["status"], diagnostics: readonly Diagnostic[] = row.diagnostics): WorkResult => ({ blockIndex, candidates: [], diagnostics, status, truncated: false });
    if (!block.aligned) return empty("unaligned");
    const layer = options.direction === "to-notes" ? "notation" : "melody";
    if (!row.cells.length || row.cells.some(cell => !cell.syllable[layer])) return empty("missing-layer");
    const [{ translatePhrase, resolveEvidence, convertNeumes, parseMelody, unicodeSlavonic, melodyKey }, { createBuiltinCatalog }] = await Promise.all([import("@znamenica/kruczie"), import("@znamenica/kruczie/data")]);
    catalog ??= createBuiltinCatalog();
    const translated = translatePhrase(catalog, row.cells.map(cell => cell.syllable), { ...options, maxCandidates: 4, maxSteps: 15000 });
    const candidates: WorkCandidate[] = translated.candidates.map(candidate => ({
        syllables: candidate.syllables,
        cells: candidate.syllables.map(syllable => ({
            syllable: { ...syllable, ...(syllable.melody ? { melody: parseMelody(syllable.melody.raw).value! } : {}) },
            textUnicode: unicodeSlavonic(syllable.text.raw),
            unicode: syllable.notation ? convertNeumes(syllable.notation.raw).value!.unicode : "",
        })),
        notes: candidate.syllables.map(s => s.melody?.raw ?? "").join(" "),
        neumes: candidate.syllables.map(s => s.notation?.raw ?? "").join(" "),
        preferred: candidate.preferred,
        origins: [...new Set(candidate.translation.evidence.map(evidence => {
            const source = resolveEvidence(catalog!, evidence);
            return source?.kind === "formula" ? `${source.source?.name ?? "Источник"}: ${source.formula.name}` : source?.kind === "symbol" ? `Знамя: ${source.symbol.groupName} — ${source.symbol.name}` : evidence.recordKey;
        }))],
    }));
    const positions: { index: number; notes: string[]; melodies: Melody[]; rankings?: CorpusRanking[] }[] = [];
    if (!candidates.length) for (const [index, cell] of row.cells.entries()) {
        const scalar = translatePhrase(catalog, [cell.syllable], { ...options, maxCandidates: 3, maxSteps: 2500 });
        const notes = [...new Set(scalar.candidates.map(c => c.syllables.map(s => s.melody?.raw ?? "").join(" ")).filter(Boolean))];
        if (notes.length) positions.push({ index, notes, melodies: notes.map(raw => parseMelody(raw).value!) });
    }
    const index = await builtinCorpusIndex();
    const context = { tradition: options.tradition, tone: options.tone, sourceId: options.corpusSourceId };
    for (const candidate of candidates) candidate.ranking = scoreCorpusSequence(index, candidate.syllables.map(s => ({ neumes: s.notation?.raw ?? "", notes: s.melody?.raw ?? null })), context);
    candidates.sort((a,b) => (b.ranking?.score ?? 0) - (a.ranking?.score ?? 0));
    if (candidates[0]?.ranking?.score) candidates.forEach((c,i) => { c.preferred = i === 0 && c.ranking!.score > (candidates[1]?.ranking?.score ?? -1); });
    let recommendation: WorkResult["recommendation"];
    if (!candidates.length && options.direction === "to-notes") {
        let corpusLimited = false;
        const choices = row.cells.map((cell, position) => {
            const variants = new Map<string | null,string>();
            for (const notes of [...getCorpusRealizations(index, cell.syllable.notation!.raw, context), ...(positions.find(p=>p.index===position)?.notes ?? [])]) if (!variants.has(melodyKey(notes))) variants.set(melodyKey(notes),notes);
            if (variants.size > 16) corpusLimited = true;
            return { neumes: cell.syllable.notation!.raw, options: cell.syllable.melody ? [cell.syllable.melody.raw] : [...variants.values()].slice(0,16) };
        });
        for (const cell of row.cells) if (getCorpusRealizations(index, cell.syllable.notation!.raw, context).length > 16) corpusLimited = true;
        const search = suggestCorpusSequences(index, choices, context);
        const best = search.sequences[0];
        if (best?.ranking.score) recommendation = { notes: best.groups.map(g => g.notes), ranking: best.ranking, truncated: search.truncated || corpusLimited, tied: search.sequences.filter(s => Math.abs(s.ranking.score-best.ranking.score)<1e-9).length };
        for (const [position, choice] of choices.entries()) {
            const ordered = choice.options.map((notes, order) => {
                const sequence = search.sequences.find(s => s.groups[position].notes === notes);
                const base = sequence?.ranking ?? scoreCorpusSequence(index, [{ neumes: choice.neumes, notes }], context);
                const evidence = sequence ? base.evidence.filter(e => e.start <= position && e.end > position) : base.evidence.map(e => ({ ...e,start:e.start+position,end:e.end+position }));
                const ranking = { ...base,evidence };
                return { notes, ranking, order };
            }).sort((a,b) => b.ranking.score - a.ranking.score || a.order - b.order);
            if (!ordered.length) continue;
            const value = { index: position, notes: ordered.map(v=>v.notes), melodies: ordered.map(v=>parseMelody(v.notes).value!), rankings: ordered.map(v=>v.ranking) };
            const old = positions.findIndex(p=>p.index===position);
            if (old < 0) positions.push(value); else positions[old] = value;
        }
        positions.sort((a,b)=>a.index-b.index);
    }
    return { blockIndex, candidates, positions, recommendation, diagnostics: [...row.diagnostics, ...translated.diagnostics], truncated: translated.truncated, status: candidates.length ? "translated" : "untranslated" };
}

export function draftsOf(cells: readonly WorkCell[]): CellDraft[] {
    return cells.map(({ syllable }) => ({ notation: syllable.notation?.raw ?? "", melody: syllable.melody?.raw ?? "", text: syllable.text.raw, separator: syllable.text.separator ?? " " }));
}
function diagnosticError(diagnostics: readonly Diagnostic[]): Error {
    return new Error(diagnostics.map(d => `${d.code}: ${d.message}`).join("\n"));
}
/** Explicit correction can repair an unaligned block; only its original source range is rewritten. */
export async function saveBlockLayers(raw: string, blockIndex: number, layers: { notation?: string; melody?: string; text: string }): Promise<string> {
    const { importZnamenText } = await import("./znamen");
    const { parseZnamen, applyZnamenEdits } = await import("@znamenica/kruczie/formats/znamen");
    const file = await importZnamenText(raw), block = file.blocks[blockIndex];
    if (!block) throw new Error("Блок отсутствует.");
    if (Object.values(layers).some(value => value !== undefined && /[\r\n]/u.test(value))) throw new Error("Каждый слой блока должен занимать одну строку.");
    const body = [layers.notation === undefined ? null : `%з ${layers.notation}`, layers.melody === undefined ? null : `%н ${layers.melody}`, `%т ${layers.text}`].filter(line => line !== null).join(file.eol);
    const check = parseZnamen(body);
    if (check.value?.blocks.length !== 1 || !check.value.blocks[0].aligned) throw new Error("Число слоговых позиций не совпадает. Используйте ~~ для нескольких крюков в одной позиции, слитную запись для нот и + для нескольких слов на одной позиции.");
    if (block.aligned) {
        const result = applyZnamenEdits(file, [{ blockIndex, ...layers }]);
        if (!result.value) throw diagnosticError(result.diagnostics);
        return result.value.raw;
    }
    // The user explicitly corrected the three visible layers; no other block is touched.
    const trailing = /[\r\n]$/u.test(raw.slice(block.range.start, block.range.end)) ? file.eol : "";
    return raw.slice(0, block.range.start) + (block.range.start === 0 && file.bom ? "\uFEFF" : "") + body + trailing + raw.slice(block.range.end);
}
export async function saveBlockCells(raw: string, blockIndex: number, cells: readonly CellDraft[], notation: boolean, melody: boolean): Promise<string> {
    if (!cells.length) throw new Error("В блоке должна остаться хотя бы одна позиция.");
    if (cells.some(cell => (notation && !cell.notation.trim()) || (melody && !cell.melody.trim()))) throw new Error("Заполните музыкальные слои каждой позиции; пустое место обозначается явно.");
    const text = cells.map((cell, index) => `${cell.text || "_"}${cell.separator || (index < cells.length - 1 ? " " : "")}`).join("");
    return saveBlockLayers(raw, blockIndex, { text,
        ...(notation ? { notation: cells.map(cell => cell.notation.trim()).join(" ") } : {}),
        ...(melody ? { melody: cells.map(cell => cell.melody.replace(/\s+/gu, "")).join(" ") } : {}),
    });
}
/** Export only deliberately selected candidates; all other blocks remain verbatim. */
export async function exportWork(raw: string, selected: Readonly<Record<number, WorkCandidate>>): Promise<string> {
    const { importZnamenText } = await import("./znamen");
    const { applyZnamenEdits, serializeZnamen } = await import("@znamenica/kruczie/formats/znamen");
    const file = await importZnamenText(raw);
    const edits: ZnamenEdit[] = Object.entries(selected).map(([key, candidate]) => ({ blockIndex: Number(key),
        ...(candidate.syllables.every(s => s.notation) ? { notation: candidate.syllables.map(s => s.notation!.raw).join(" ") } : {}),
        ...(candidate.syllables.every(s => s.melody) ? { melody: candidate.syllables.map(s => s.melody!.raw).join(" ") } : {}),
    }));
    if (!edits.length) return raw;
    const result = applyZnamenEdits(file, edits);
    if (!result.value) throw diagnosticError(result.diagnostics);
    return serializeZnamen(result.value).value!;
}

/** A preview retains every source position; absent melodies never become rests. */
export function partialWorkCells(row: WorkBlock, result?: WorkResult, choices: Readonly<Record<number, number>> = {}): WorkCell[] {
    if (!result || result.status !== "untranslated" || result.candidates.length) return row.cells;
    return row.cells.map((cell, index) => {
        if (cell.syllable.melody) return cell;
        const options = result.positions?.find(position => position.index === index)?.melodies ?? [];
        const choice = choices[index] ?? (options.length === 1 ? 0 : -1);
        return { ...cell, partial: true, melodyOptions: options, melodyRankings: result.positions?.find(p => p.index === index)?.rankings,
            syllable: { ...cell.syllable, ...(options[choice] ? { melody: options[choice] } : {}) } };
    });
}
