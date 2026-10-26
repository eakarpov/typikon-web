import type { Catalog, ChantTradition, Tone } from "@znamenica/kruczie";
export interface ReferenceObservation { midi: number; count: number }
export interface ToneReferenceProfile {
    tradition: ChantTradition;
    tone: Tone;
    formulaCount: number;
    sourceIds: (string | number)[];
    endings: ReferenceObservation[];
}
/** An empirical suggestion, not an assertion that a glas has one fixed tonic. */
export async function buildReferenceProfiles(catalog: Catalog): Promise<ToneReferenceProfile[]> {
    const { getMeasuredNotes, pitchNumber, melodyKey } = await import("@znamenica/kruczie/melody");
    const profiles: ToneReferenceProfile[] = [];
    for (const tradition of ["znamenny", "demestvenny"] as const) for (const tone of [1,2,3,4,5,6,7,8] as const) {
        const seen = new Set<string>(), sources = new Set<string | number>(), endings = new Map<number, number>();
        for (const formula of catalog.dataset.formulas) {
            if (formula.tradition !== tradition || !formula.tones.includes(tone)) continue;
            const raw = formula.valueNotes?.join(" ") ?? "", key = melodyKey(raw);
            if (!key) continue;
            const notes = getMeasuredNotes(raw).value;
            if (!notes?.length) continue;
            sources.add(formula.sourceId);
            if (seen.has(key)) continue;
            seen.add(key);
            const midi = pitchNumber(notes[notes.length - 1].pitch);
            endings.set(midi, (endings.get(midi) ?? 0) + 1);
        }
        if (seen.size) profiles.push({ tradition, tone, formulaCount: seen.size, sourceIds: [...sources], endings: [...endings].map(([midi,count]) => ({midi,count})).sort((a,b) => b.count - a.count || a.midi - b.midi) });
    }
    return profiles;
}
