import type { MelodyEvent, Pitch } from "@znamenica/kruczie/melody";

export type NoteStyle = "round" | "kievan";
export interface DisplayNote {
    glyph: string;
    y: number;
    accidental: string;
    dot: boolean;
    ledgers: number[];
    raw: string;
    warning?: string;
}
// Bravura/SMuFL: https://smufl.formats.music/latest/tables/kievan-square-notation.html
const stepIndex = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
/** Five-line staff: E4 bottom line (y=90), B4 middle line (y=70). */
export function staffY(pitch: Pitch): number {
    return 70 - (pitch.octave * 7 + stepIndex[pitch.step] - 34) * 5;
}
export function displayNotes(events: readonly MelodyEvent[], style: NoteStyle, displayOctave: -1 | 0 = 0): DisplayNote[] {
    return events.filter(e => e.kind === "note" || e.kind === "reciting").map(event => {
        if (event.kind !== "note" && event.kind !== "reciting") throw new Error("Expected note");
        const y = staffY({ ...event.pitch, octave: event.pitch.octave + displayOctave }), down = y < 70;
        const onLine = (y - 50) % 10 === 0;
        const ledgers: number[] = [];
        for (let line = 40; line >= y; line -= 10) ledgers.push(line);
        for (let line = 100; line <= y; line += 10) ledgers.push(line);
        const accidental = event.pitch.alteration === -1 ? (style === "kievan" ? "\uEC3E" : "\uE260")
            : event.pitch.alteration === 1 ? (style === "kievan" ? "\uEC3D" : "\uE262") : "";
        if (event.kind === "reciting") return { glyph: style === "kievan" ? "\uEC32" : "", y, accidental, dot: false, ledgers, raw: event.raw,
            ...(style === "round" ? { warning: "Речитация показана исходной строкой; длительность не назначена." } : {}) };
        const beats = event.duration.beats;
        const dot = beats === 1.5 || beats === 3 || beats === 6;
        const base = dot ? beats! / 1.5 : beats;
        let glyph = "";
        if (style === "round") glyph = base === .5 ? (down ? "\uE1D8" : "\uE1D7")
            : base === 1 ? (down ? "\uE1D6" : "\uE1D5")
            : base === 2 ? (down ? "\uE1D4" : "\uE1D3")
            : base === 4 ? "\uE1D2" : base === 8 ? "\uE1D1" : "";
        else glyph = base === .5 ? (down ? "\uEC3A" : "\uEC39")
            : base === 1 ? (down ? "\uEC38" : "\uEC37")
            : base === 2 ? (onLine ? "\uEC35" : "\uEC36")
            : base === 4 ? "\uEC33" : "";
        return { glyph, y, accidental, dot, ledgers, raw: event.raw,
            ...(!glyph ? { warning: `Длительность «${event.duration.raw}» показана исходной строкой; для неё пока не задано начертание в выбранной нотации.` } : {}) };
    });
}
