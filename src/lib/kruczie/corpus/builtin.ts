import type { NgramIndex } from "@znamenica/kruczie/ngrams";
import { loadNgramApi } from "./index";
let pending: Promise<NgramIndex> | undefined;
/** The corpus and source books are never sent to the browser. */
export function builtinCorpusIndex(): Promise<NgramIndex> {
    return pending ??= loadNgramApi().then(()=>import("@znamenica/kruczie/ngrams/data")).then(api=>api.createBuiltinNgramIndex());
}
