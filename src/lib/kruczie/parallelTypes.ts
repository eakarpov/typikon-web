import type { ChantTradition, Tone } from "@znamenica/kruczie";
export interface ParallelGroup { neumes: string; notes: string; text: string; block: number; position: number; ordinal: number; segment: number }
export interface ParallelWitness { id: string; workId: string; sourceId: string; url: string; sha256: string; tradition: ChantTradition; tone?: Tone; groups: readonly ParallelGroup[] }
export interface ParallelWork { version: string; code: string; witnesses: readonly ParallelWitness[]; truncated?: boolean }
export interface ParallelIndex { version: string; works: readonly { id: string; canonicalCode: string; aliases?: readonly string[] }[]; witnesses: readonly Omit<import("./corpus/types").ChantWitness, "attribution" | "rightsUrl">[] }
export interface SequencePreference {
    scope: "work" | "line";
    priority: readonly number[];
    orders: { triples: number; pairs: number; singles: number };
    unsupportedJoinCost: number;
    reference?: { sourceId: string; workId: string; url: string; tone?: Tone; aligned: number; matched: number; total: number; positions: readonly { position: number; sourceBlock: number; sourcePosition: number; notes: string; exact: boolean }[] };
}

export interface ParallelRealization {
    position: number; notes: string; sourceNeumes: string; sourceId: string; url: string; sourceBlock: number; sourcePosition: number;
    match: "exact" | "text-family";
}
