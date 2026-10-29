/** ESM-only package is loaded explicitly; the portal's TS test runner also supports CJS. */
export type * from "./types";
import { searchCoherentSequences } from "../sequenceRanking";
export type { NgramIndex as CorpusIndex } from "@znamenica/kruczie/ngrams";
import type { ChantCollection } from "./types";
import type { NgramIndex, NgramContext, NgramGroup } from "@znamenica/kruczie/ngrams";
let api: typeof import("@znamenica/kruczie/ngrams") | undefined;
let notation: typeof import("@znamenica/kruczie") | undefined;
export function notationApi() { if (!notation) throw new Error("Сначала загрузите модель N-грамм."); return notation; }
export async function loadNgramApi() { notation ??= await import("@znamenica/kruczie"); return api ??= await import("@znamenica/kruczie/ngrams"); }
export { getCorpusSupplement, getCorpusUnpitchedVariants } from "./unpitched";
export function ngramApi() { if (!api) throw new Error("Сначала загрузите модель N-грамм."); return api; }
export async function createCorpusIndex(collection: ChantCollection) {
    const [{ trainNgramModel }, runtime] = await Promise.all([import("./train"),loadNgramApi()]);
    return runtime.createNgramIndex(await trainNgramModel(collection));
}
export function getCorpusRealizations(index: NgramIndex, neumes: string, context: NgramContext) { return ngramApi().getNgramRealizations(index,neumes,context); }
export function scoreCorpusSequence(index: NgramIndex, groups: readonly NgramGroup[], context: NgramContext) { return ngramApi().scoreNgramSequence(index,groups,context); }
export function rankCorpusSequences(index: NgramIndex, groups: readonly (readonly NgramGroup[])[], context: NgramContext) { return ngramApi().rankNgramSequences(index,groups,context); }
export function suggestCorpusSequences(index: NgramIndex, positions: readonly { neumes: string; options: readonly string[] }[], context: NgramContext, width=64) { return searchCoherentSequences(index,positions,context,width); }

export function getCorpusFallbacks(index: NgramIndex, neumes: string, context: NgramContext) { return ngramApi().getNgramFallbacks(index, neumes, context); }
