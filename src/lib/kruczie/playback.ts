import type { Diagnostic } from "@znamenica/kruczie";
import { midiToHz } from "../tunes/notation/playback";

export interface PlaybackTone {
    hz: number;
    start: number;
    duration: number;
    /** Small articulation gap, without changing note onset times. */
    soundingDuration: number;
}
export interface PlaybackPlan {
    tones: PlaybackTone[];
    duration: number;
}
export interface PlaybackResult {
    value: PlaybackPlan | null;
    diagnostics: readonly Diagnostic[];
}
/** Use the package's measured durations; never invent a duration for reciting notes. */
export async function createPlaybackPlan(raw: string, bpm: number, semitones = 0): Promise<PlaybackResult> {
    if (!Number.isSafeInteger(semitones)) return { value: null, diagnostics: [{ code: "INVALID_PLAYBACK_REFERENCE", severity: "error", message: "Сдвиг опорной высоты должен быть целым числом полутонов." }] };
    const { getPlaybackSchedule, pitchNumber } = await import("@znamenica/kruczie/melody");
    const schedule = getPlaybackSchedule(raw, bpm);
    if (!schedule.value) return { value: null, diagnostics: schedule.diagnostics };
    if (!schedule.value.length) return { value: null, diagnostics: [{ code: "EMPTY_PLAYBACK", severity: "error", message: "В записи нет измеренных нот для воспроизведения." }] };
    const tones = schedule.value.map(note => ({
        hz: midiToHz(pitchNumber(note.pitch) + semitones),
        start: note.start,
        duration: note.duration,
        soundingDuration: Math.max(note.duration * .5, note.duration - .055),
    }));
    return { value: { tones, duration: Math.max(...tones.map(note => note.start + note.duration)) }, diagnostics: schedule.diagnostics };
}
