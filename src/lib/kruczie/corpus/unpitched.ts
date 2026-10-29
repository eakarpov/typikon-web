import type { NgramIndex, NgramContext } from "@znamenica/kruczie/ngrams";
import type { CorpusFallback } from "./types";
import { getCorpusRealizations, getCorpusFallbacks, scoreCorpusSequence } from "./index";
import { notationApi } from "./index";

// Only explicit pitch letters. Expressive marks р/т/б/у/л/к, cues and range marks stay exact.
const pitch = /^((?:\([^()]*\))*)(?:[ГНцгнсмпвМПВ][#@]?)+/u;
function shape(raw: string): { key: string; pitched: boolean } | undefined {
    const { normalizeNeumes, parseNeumeGroup } = notationApi();
    const normalized = normalizeNeumes(raw);
    const parts = normalized.split(/\s+/u);
    if (!parts.length || parts.some(part => !parseNeumeGroup(part).value?.recognized)) return undefined;
    let pitched = false;
    const key = parts.map(part => { const stripped = part.replace(pitch, "$1"); pitched ||= stripped !== part; return stripped; }).join(" ");
    return key ? { key, pitched } : undefined;
}
const cache = new WeakMap<NgramIndex, Map<string, string[]>>();
/** Suggestions retain the original pitched spelling and never count as exact N-gram evidence. */
export function getCorpusUnpitchedVariants(index: NgramIndex, neumes: string, context: NgramContext): Omit<CorpusFallback, "position" | "neumes">[] {
    const query = shape(neumes);
    if (!query || query.pitched || context.tradition !== "znamenny" || getCorpusRealizations(index, neumes, context).length) return [];
    let shapes = cache.get(index);
    if (!shapes) {
        shapes = new Map();
        for (const raw of index.model.neumes) { const item = shape(raw); if (item?.pitched) { const list = shapes.get(item.key) ?? []; list.push(raw); shapes.set(item.key, list); } }
        cache.set(index, shapes);
    }
    const variants = shapes.get(query.key) ?? [];
    const strict = variants.flatMap(sourceNeumes => getCorpusRealizations(index, sourceNeumes, context).map(notes => ({ sourceNeumes, notes, ranking: scoreCorpusSequence(index, [{ neumes: sourceNeumes, notes }], context) })));
    const outsideTone = !strict.length && context.tone !== undefined;
    const found = strict.length ? strict : variants.flatMap(sourceNeumes => getCorpusFallbacks(index, sourceNeumes, context).map(item => ({ ...item, sourceNeumes })));
    return found.map(item => ({ ...item, kind: "unpitched" as const, requestedTone: context.tone, outsideTone }))
        .sort((a,b) => b.ranking.score - a.ranking.score || a.sourceNeumes.localeCompare(b.sourceNeumes, "en") || a.notes.localeCompare(b.notes, "en"));
}
/** Exact out-of-tone matches precede shape-based proposals. */
export function getCorpusSupplement(index: NgramIndex, neumes: string, context: NgramContext): Omit<CorpusFallback, "position" | "neumes">[] {
    const exact = getCorpusFallbacks(index, neumes, context);
    return exact.length ? exact : getCorpusUnpitchedVariants(index, neumes, context);
}
