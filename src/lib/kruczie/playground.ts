import { builtinCorpusIndex } from "./corpus/builtin";
import { scoreCorpusSequence, getCorpusRealizations, getCorpusFallbacks, suggestCorpusSequences } from "./corpus";
import type { Catalog } from "@znamenica/kruczie";
import { MAX_INPUT_LENGTH, type ConversionRequest, type ConversionView, type CandidateView } from "./model";

let catalog: Catalog | undefined;

/** Pure package calls; the UI runs this module in a dedicated worker. */
export async function runConversion(request: ConversionRequest): Promise<ConversionView> {
    const input = request.input.trim();
    if (!input || input.length > MAX_INPUT_LENGTH) throw new Error(`Введите запись длиной от 1 до ${MAX_INPUT_LENGTH} знаков.`);
    if (request.direction !== "to-notes" && request.direction !== "to-neumes") throw new Error("Неизвестное направление перевода.");
    if (request.tradition !== "znamenny" && request.tradition !== "demestvenny") throw new Error("Неизвестный распев.");
    if (request.tone !== undefined && (!Number.isInteger(request.tone) || request.tone < 1 || request.tone > 8)) throw new Error("Глас должен быть от 1 до 8.");
    const [{ neumesToNotes, notesToNeumes, resolveEvidence, convertNeumes }, { getMeasuredNotes, parseMelody, melodyKey }, { createBuiltinCatalog }] = await Promise.all([
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
    const candidates: CandidateView[] = result.candidates.map(candidate => ({
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
    let corpusCoverage: ConversionView["corpusCoverage"];
    if (request.direction === "to-notes" && !candidates.length && !parsed.diagnostics.some(d => d.severity === "error")) {
        const context = { tradition: request.tradition, tone: request.tone, sourceId: request.corpusSourceId };
        const groups = input.split(/\s+/u).filter(Boolean); // Keep explicit ~~ syllabic groups intact.
        const fallbacks = new Map<number, ReturnType<typeof getCorpusFallbacks>>();
        let corpusLimited = false;
        const choices = groups.map((neumes, position) => {
            const scalar = neumesToNotes(catalog!, neumes, { ...options, maxCandidates: 3, maxSteps: 2500 });
            let notes = [...getCorpusRealizations(corpus, neumes, context), ...scalar.candidates.map(c => c.notes)];
            if (!notes.length) { const found = getCorpusFallbacks(corpus, neumes, context); fallbacks.set(position, found); notes = found.map(f => f.notes); }
            const unique = [...new Map(notes.filter(n => getMeasuredNotes(n).value?.length).map(n => [melodyKey(n), n])).values()];
            if (unique.length > 16) corpusLimited = true;
            return { neumes, options: unique.slice(0, 16) };
        });
        if (choices.length && choices.every(choice => choice.options.length)) {
            const search = suggestCorpusSequences(corpus, choices, context);
            const fallbackFor = (position: number, notes: string | null) => fallbacks.get(position)?.find(f => notes !== null && melodyKey(f.notes) === melodyKey(notes));
            const fallbackScore = (values: readonly { notes: string | null }[]) => values.reduce((n, v, position) => n + (fallbackFor(position, v.notes)?.ranking.score ?? 0), 0);
            const sequences = [...search.sequences].sort((a, b) => (b.ranking?.score ?? 0) - (a.ranking?.score ?? 0) || fallbackScore(b.groups) - fallbackScore(a.groups));
            const seen = new Set<string | null>();
            for (const sequence of sequences) {
                const notes = sequence.groups.map(g => g.notes!).join(" "), key = melodyKey(notes);
                if (seen.has(key)) continue; seen.add(key);
                const borrowed = sequence.groups.flatMap((g, position) => { const f = fallbackFor(position, g.notes); return f ? [{ ...f, position, neumes: g.neumes }] : []; });
                candidates.push({ neumes: input, unicode: convertNeumes(input).value!.unicode, notes, melody: parseMelody(notes).value!, kind: "constructed",
                    origins: ["Составлено из наблюдаемых соответствий корпуса двоезнаменников", ...(borrowed.length ? [`Есть запасные варианты вне гласа ${request.tone}; см. источники у результата`] : [])],
                    ranking: { ...sequence.ranking, ...(borrowed.length ? { fallbacks: borrowed } : {}) } });
                if (candidates.length === 8) break;
            }
            corpusCoverage = { covered: choices.length, total: choices.length, outsideTone: candidates[0]?.ranking?.fallbacks?.length ?? 0, version: corpus.model.version, truncated: search.truncated || corpusLimited };
        }
    }
    candidates.sort((a,b) => (a.kind === b.kind ? (b.ranking?.score ?? 0) - (a.ranking?.score ?? 0) : a.kind === "matched" ? -1 : 1));
    return { result: { ...result, diagnostics }, candidates, datasetVersion: catalog.dataset.manifest.version, ...(corpusCoverage ? { corpusCoverage } : {}) };
}
