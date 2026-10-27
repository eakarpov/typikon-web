import type { ChantWitness } from "./types";
export type * from "./types";
import type { ChantCollection, CorpusContext, CorpusEvidence, CorpusRanking, CorpusReference, RankingGroup, RankedSequence } from "./types";
interface Observation { notes: readonly string[]; noteKey: string; refs: CorpusReference[]; tradition: string; tone?: number; cluster: string; occurrence: string }
export interface CorpusIndex { version: string; windows: ReadonlyMap<string, readonly Observation[]>; normalize: (raw: string) => string; melodyKey: (raw: string) => string | null; witnessCount: number }
function windowKey(neumes: readonly string[]): string { return JSON.stringify(neumes); }
/** Only verified double-notation samples train the index. Repeated witnesses do not inflate counts. */
export async function createCorpusIndex(collection: ChantCollection): Promise<CorpusIndex> {
    const [{ normalizeNeumes }, { melodyKey, getMeasuredNotes }] = await Promise.all([import("@znamenica/kruczie"), import("@znamenica/kruczie/melody")]);
    const witnesses = new Map(collection.witnesses.map(w => [w.id, w]));
    const byWitness = new Map<string, typeof collection.samples[number][]>();
    for (const sample of collection.samples) {
        const w = witnesses.get(sample.witnessId);
        if (!w || w.notationKind !== "double") continue;
        if (!sample.positions.length || sample.positions.some(p => !normalizeNeumes(p.neumes) || !getMeasuredNotes(p.notes).value?.length)) continue;
        const list = byWitness.get(w.id) ?? []; list.push(sample); byWitness.set(w.id, list);
    }
    const clusters = new Map<string, { witness: ChantWitness; samples: typeof collection.samples[number][] }[]>();
    for (const [id, samples] of byWitness) {
        const witness = witnesses.get(id)!;
        // Full transcription, including syllables and musical block boundaries, defines a copy.
        const fingerprint = JSON.stringify([witness.tradition, samples.map(s => s.positions.map(p => [normalizeNeumes(p.neumes), melodyKey(p.notes), p.text.trim()]))]);
        const copies = clusters.get(fingerprint) ?? []; copies.push({ witness, samples }); clusters.set(fingerprint, copies);
    }
    const windows = new Map<string, Observation[]>();
    let ordinal = 0;
    for (const copies of clusters.values()) {
        const cluster = String(ordinal++);
        const first = copies[0];
        for (const [blockOffset, sample] of first.samples.entries()) for (let start = 0; start < sample.positions.length; start++) {
            let hooks = 0;
            for (let end = start + 1; end <= Math.min(sample.positions.length, start + 3); end++) {
                const item = sample.positions[end - 1];
                hooks += normalizeNeumes(item.neumes).split(/\s+|~~/u).filter(Boolean).length;
                if (hooks > 3) break;
                const positions = sample.positions.slice(start, end), neumes = positions.map(p => normalizeNeumes(p.neumes)), notes = positions.map(p => p.notes);
                const key = windowKey(neumes), values = windows.get(key) ?? [];
                // Each context keeps its own source/tone metadata; copies count once when contexts are pooled.
                for (const copy of copies) {
                    const referenceSample = copy.samples[blockOffset];
                    values.push({ notes, noteKey: JSON.stringify(notes.map(melodyKey)), cluster, occurrence: JSON.stringify([cluster, blockOffset, start]), tradition: copy.witness.tradition, tone: copy.witness.tone,
                        refs: [{ witnessId: copy.witness.id, workId: copy.witness.workId, sourceId: copy.witness.sourceId, url: copy.witness.url, block: referenceSample.block, position: referenceSample.positions[start].position, ...(referenceSample.recovery ? { recovery: referenceSample.recovery } : {}) }] });
                }
                windows.set(key, values);
                // A source end/bar terminates a phrase; do not count across it.
                if (item.phraseEnd || /[\\/]/u.test(item.notes)) break;
            }
        }
    }
    return { version: collection.version, windows, normalize: normalizeNeumes, melodyKey, witnessCount: byWitness.size };
}
function contextual(index: CorpusIndex, neumes: readonly string[], context: CorpusContext): Observation[] {
    const seen = new Map<string, Observation>();
    for (const observation of index.windows.get(windowKey(neumes.map(index.normalize))) ?? []) {
        if (observation.tradition !== context.tradition || (context.tone !== undefined && observation.tone !== context.tone)) continue;
        const refs = observation.refs.filter(ref => context.sourceId === undefined || ref.sourceId === context.sourceId);
        if (!refs.length) continue;
        const old = seen.get(observation.occurrence);
        if (old) old.refs.push(...refs); else seen.set(observation.occurrence, { ...observation, refs: [...refs] });
    }
    return [...seen.values()];
}
export function getCorpusRealizations(index: CorpusIndex, neumes: string, context: CorpusContext): string[] {
    const counts = new Map<string, { raw: string; count: number }>();
    for (const observation of contextual(index, [neumes], context)) {
        const item = counts.get(observation.noteKey) ?? { raw: observation.notes[0], count: 0 }; item.count++; counts.set(observation.noteKey, item);
    }
    return [...counts.values()].sort((a,b) => b.count - a.count || a.raw.localeCompare(b.raw, "en")).map(v => v.raw);
}
/** Positive empirical support score, not a probability or a claim of correctness. */
export function scoreCorpusSequence(index: CorpusIndex, groups: readonly RankingGroup[], context: CorpusContext): CorpusRanking {
    const evidence: CorpusEvidence[] = [], covered = new Set<number>(); let score = 0;
    for (let start = 0; start < groups.length; start++) {
        let hooks = 0;
        for (let end = start + 1; end <= Math.min(groups.length, start + 3); end++) {
            const item = groups[end - 1]; if (!item.notes) break;
            hooks += index.normalize(item.neumes).split(/\s+|~~/u).filter(Boolean).length;
            if (hooks > 3 || hooks < 1) break;
            const segment = groups.slice(start,end), observations = contextual(index, segment.map(g => g.neumes), context);
            const key = JSON.stringify(segment.map(g => index.melodyKey(g.notes!)));
            const hits = observations.filter(o => o.noteKey === key);
            if (hits.length) {
                score += [0,1,2,4][hooks] * Math.log1p(hits.length) * hits.length / observations.length;
                for (let i = start; i < end; i++) covered.add(i);
                const refs = hits.flatMap(o => o.refs);
                evidence.push({ order: hooks as 1|2|3, start, end, neumes: segment.map(g => g.neumes), notes: segment.map(g => g.notes!), count: hits.length, total: observations.length,
                    chantCount: new Set(hits.map(o => o.cluster)).size, sourceIds: [...new Set(refs.map(r => r.sourceId))].sort(), examples: refs.slice(0, 5) });
            }
            if (/[\\/]/u.test(item.notes)) break;
        }
    }
    evidence.sort((a,b) => b.order - a.order || b.count - a.count || a.start - b.start);
    return { score, evidence, supportedPositions: covered.size, corpusVersion: index.version };
}
export function rankCorpusSequences(index: CorpusIndex, sequences: readonly (readonly RankingGroup[])[], context: CorpusContext): RankedSequence[] {
    return sequences.map((groups, order) => ({ groups, ranking: scoreCorpusSequence(index, groups, context), order })).sort((a,b) => b.ranking.score - a.ranking.score || a.order - b.order).map(({ groups, ranking }) => ({ groups, ranking }));
}
/** Bounded whole-line search. A missing position resets context instead of becoming a rest. */
export function suggestCorpusSequences(index: CorpusIndex, positions: readonly { neumes: string; options: readonly string[] }[], context: CorpusContext, width = 64): { sequences: RankedSequence[]; truncated: boolean } {
    if (!Number.isInteger(width) || width < 1 || width > 256) throw new Error("Ширина поиска должна быть от 1 до 256.");
    let beam: RankedSequence[] = [{ groups: [], ranking: scoreCorpusSequence(index, [], context) }], truncated = false;
    for (const position of positions) {
        const next = beam.flatMap(prefix => (position.options.length ? position.options : [null]).map(notes => [...prefix.groups, { neumes: position.neumes, notes }]));
        const ranked = rankCorpusSequences(index, next, context);
        if (ranked.length > width) truncated = true;
        beam = ranked.slice(0,width);
    }
    return { sequences: beam, truncated };
}
