import type { ChantTradition, Tone } from "@znamenica/kruczie";
import data from "@/data/kruczie-tone-references.json";
import type { ToneReferenceProfile } from "./referenceStats";

export interface PitchReferenceSettings { enabled: boolean; writtenMidi?: number; soundingMidi: number }
export const DEFAULT_PITCH_REFERENCE: PitchReferenceSettings = { enabled: false, soundingMidi: 62 };
export function referenceProfile(tradition: ChantTradition, tone?: Tone): ToneReferenceProfile | undefined {
    return data.profiles.find(profile => profile.tradition === tradition && profile.tone === tone) as ToneReferenceProfile | undefined;
}
export function suggestedReference(profile?: ToneReferenceProfile): number | null {
    if (!profile?.endings.length || profile.endings[0].count === profile.endings[1]?.count) return null;
    return profile.endings[0].midi;
}
export function writtenReference(settings: PitchReferenceSettings, tradition: ChantTradition, tone?: Tone): number | null {
    return settings.writtenMidi ?? suggestedReference(referenceProfile(tradition, tone));
}
/** A modal reference frame, independent of the melody's first and last notes. */
export function referenceShift(settings: PitchReferenceSettings, tradition: ChantTradition, tone?: Tone): number {
    const source = writtenReference(settings, tradition, tone);
    return settings.enabled && source !== null ? settings.soundingMidi - source : 0;
}
export function pitchLabel(midi: number): string {
    const names = ["До", "До♯", "Ре", "Ми♭", "Ми", "Фа", "Фа♯", "Соль", "Ля♭", "Ля", "Си♭", "Си"];
    const latin = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    return `${names[midi % 12]} (${latin[midi % 12]}${Math.floor(midi / 12) - 1})`;
}
export const REFERENCE_DATASET_VERSION = data.datasetVersion;
