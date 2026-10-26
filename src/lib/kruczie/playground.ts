import { builtinCorpusIndex } from "./corpus/builtin";
import { scoreCorpusSequence } from "./corpus";
import type { Catalog } from "@znamenica/kruczie";
import { MAX_INPUT_LENGTH, type ConversionRequest, type ConversionView } from "./model";

let catalog: Catalog | undefined;

/** Pure package calls; the UI runs this module in a dedicated worker. */
export async function runConversion(request: ConversionRequest): Promise<ConversionView> {
    const input = request.input.trim();
    if (!input || input.length > MAX_INPUT_LENGTH) throw new Error(`Введите запись длиной от 1 до ${MAX_INPUT_LENGTH} знаков.`);
    if (request.direction !== "to-notes" && request.direction !== "to-neumes") throw new Error("Неизвестное направление перевода.");
    if (request.tradition !== "znamenny" && request.tradition !== "demestvenny") throw new Error("Неизвестный распев.");
    if (request.tone !== undefined && (!Number.isInteger(request.tone) || request.tone < 1 || request.tone > 8)) throw new Error("Глас должен быть от 1 до 8.");
    const [{ neumesToNotes, notesToNeumes, resolveEvidence, convertNeumes }, { getMeasuredNotes, parseMelody }, { createBuiltinCatalog }] = await Promise.all([
        import("@znamenica/kruczie"), import("@znamenica/kruczie/melody"), import("@znamenica/kruczie/data"),
    ]);
    catalog ??= createBuiltinCatalog();
    const options = { tradition: request.tradition, ...(request.tone ? { tone: request.tone } : {}), maxCandidates: 8, maxSteps: 20000 };
    const result = request.direction === "to-notes"
        ? neumesToNotes(catalog, input, options)
        : notesToNeumes(catalog, input, options);
    // Translation diagnostics alone summarize unreadable input. Preserve parser locations too.
    const parsed = request.direction === "to-notes" ? convertNeumes(input) : getMeasuredNotes(input);
    const diagnostics = [...result.diagnostics, ...parsed.diagnostics];
    const corpus = await builtinCorpusIndex();
    const candidates = result.candidates.map(candidate => ({
        ranking: scoreCorpusSequence(corpus, candidate.segments.flatMap(segment => segment.groups.map(group => ({ neumes: group.neumes, notes: group.notes }))), { tradition: request.tradition, tone: request.tone, sourceId: request.corpusSourceId }),
        neumes: candidate.neumes,
        unicode: convertNeumes(candidate.neumes).value!.unicode,
        melody: parseMelody(candidate.notes).value!,
        notes: candidate.notes,
        kind: candidate.kind,
        origins: [...new Set(candidate.evidence.map(evidence => {
            const resolved = resolveEvidence(catalog!, evidence);
            if (!resolved) return "Ссылка на запись не разрешена";
            if (resolved.kind === "symbol") return `Знамя: ${resolved.symbol.groupName} — ${resolved.symbol.name}`;
            const tones = resolved.formula.tones.length ? `; гласы ${resolved.formula.tones.join(", ")}` : "";
            const fragment = resolved.groupStart !== undefined ? `; группы ${resolved.groupStart + 1}–${resolved.groupEnd}` : "";
            return `${resolved.source?.name ?? "Источник не указан"}: ${resolved.formula.name}${tones}${fragment}`;
        }))],
    }));
    candidates.sort((a,b) => (a.kind === b.kind ? b.ranking.score - a.ranking.score : a.kind === "matched" ? -1 : 1));
    return { result: { ...result, diagnostics }, candidates, datasetVersion: catalog.dataset.manifest.version };
}
