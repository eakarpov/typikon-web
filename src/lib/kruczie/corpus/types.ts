import type { ChantTradition, Tone } from "@znamenica/kruczie";
/** One work can have independent witnesses in different musical notations. */
export type ChantNotationKind = "double" | "neumes-pitched" | "neumes-unpitched" | "notes";
export interface ChantWork { id: string; canonicalCode: string; genre: "sticheron" | "unspecified"; title?: string; aliases?: readonly string[]; collectionId?: string; liturgicalContext?: { book?: string; service?: string; feast?: string; position?: string } }
export interface ChantWitness {
    id: string; workId: string; sourceId: string; tradition: ChantTradition; notationKind: ChantNotationKind;
    tone?: Tone; toneEvidence: string; url: string; rawPath: string; sha256: string; attribution: string; rightsUrl: string;
}
export interface CorpusPosition { neumes: string; notes: string; text: string; position: number; phraseEnd?: boolean }
export interface CorpusSample { witnessId: string; block: number; positions: readonly CorpusPosition[] }
export interface ChantCollection {
    schemaVersion: 1; version: string; works: readonly ChantWork[]; witnesses: readonly ChantWitness[];
    sources: readonly { id: string; title: string }[]; samples: readonly CorpusSample[];
    audit: { rejectedBlocks: number; rejectedPositions: number; doubleWitnesses: number; discoveryErrors: number; scope: string };
}
export interface CorpusContext { tradition: ChantTradition; tone?: Tone; sourceId?: string }
export interface CorpusReference { witnessId: string; workId: string; sourceId: string; url: string; block: number; position: number; phraseEnd?: boolean }
export interface CorpusEvidence {
    order: 1 | 2 | 3; start: number; end: number; neumes: readonly string[]; notes: readonly string[];
    count: number; total: number; chantCount: number; sourceIds: readonly string[]; examples: readonly CorpusReference[];
}
export interface CorpusRanking { score: number; evidence: readonly CorpusEvidence[]; supportedPositions: number; corpusVersion: string }
export interface RankingGroup { neumes: string; notes: string | null }
export interface RankedSequence { groups: readonly RankingGroup[]; ranking: CorpusRanking }
