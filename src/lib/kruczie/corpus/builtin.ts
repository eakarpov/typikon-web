import type { NgramIndex } from "@znamenica/kruczie/ngrams";
import { loadNgramApi } from "./index";
let pending: Promise<NgramIndex> | undefined;
/** Load learned counts only; compact parallel positions are fetched separately, never full books. */
export function builtinCorpusIndex(): Promise<NgramIndex> {
    return pending ??= loadNgramApi().then(()=>import("@znamenica/kruczie/ngrams/data")).then(api=>api.createBuiltinNgramIndex());
}
