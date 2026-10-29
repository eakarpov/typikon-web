import type { NgramIndex, NgramContext } from "@znamenica/kruczie/ngrams";
import type { CorpusRanking } from "./corpus/types";
import type { AlignedParallel } from "./parallelAlignment";
import { ngramApi } from "./corpus";
export function comparePriorities(a: readonly number[], b: readonly number[]) { return ngramApi().compareNgramPriorities(a,b); }
export function compareCorpusRankings(a: CorpusRanking,b: CorpusRanking) { return ngramApi().compareNgramRankings(a,b); }
export function searchCoherentSequences(index: NgramIndex, positions: readonly { neumes: string; options: readonly string[] }[],context:NgramContext,width=64,parallels:readonly AlignedParallel[]=[]) {
    return ngramApi().searchCoherentNgramSequences(index,positions,context,width,parallels);
}
