/** ESM-only package is loaded explicitly; the portal's TS test runner also supports CJS. */
export type * from "./types";
export type { NgramIndex as CorpusIndex } from "@znamenica/kruczie/ngrams";
import type { ChantCollection } from "./types";
import type { NgramIndex, NgramContext, NgramGroup } from "@znamenica/kruczie/ngrams";
let api: typeof import("@znamenica/kruczie/ngrams") | undefined;
export async function loadNgramApi() { return api ??= await import("@znamenica/kruczie/ngrams"); }
function ready() { if (!api) throw new Error("Сначала загрузите модель N-грамм."); return api; }
export async function createCorpusIndex(collection: ChantCollection) {
    const [{ trainNgramModel }, runtime] = await Promise.all([import("./train"),loadNgramApi()]);
    return runtime.createNgramIndex(await trainNgramModel(collection));
}
export function getCorpusRealizations(index: NgramIndex, neumes: string, context: NgramContext) { return ready().getNgramRealizations(index,neumes,context); }
export function scoreCorpusSequence(index: NgramIndex, groups: readonly NgramGroup[], context: NgramContext) { return ready().scoreNgramSequence(index,groups,context); }
export function rankCorpusSequences(index: NgramIndex, groups: readonly (readonly NgramGroup[])[], context: NgramContext) { return ready().rankNgramSequences(index,groups,context); }
export function suggestCorpusSequences(index: NgramIndex, positions: readonly { neumes: string; options: readonly string[] }[], context: NgramContext, width=64) { return ready().suggestNgramSequences(index,positions,context,width); }

export function getCorpusFallbacks(index: NgramIndex, neumes: string, context: NgramContext) { return ready().getNgramFallbacks(index, neumes, context); }
