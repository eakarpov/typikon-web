'use client';
import { useCallback, useEffect, useRef, useState } from "react";
import { createPlaybackPlan } from "@/lib/kruczie/playback";

interface Session {
    sources: OscillatorNode[];
    master: GainNode;
    timer: ReturnType<typeof setTimeout> | null;
    cursor: ReturnType<typeof setInterval> | null;
}
const LEAD = .08;
const FADE = .03;

/** One shared audio context/session for all candidate cards. */
export function useMelodyPlayback(bpm: number, semitones = 0) {
    const context = useRef<AudioContext | null>(null);
    const session = useRef<Session | null>(null);
    const generation = useRef(0);
    const [active, setActive] = useState<number | null>(null);
    const [noteIndex, setNoteIndex] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const stop = useCallback(() => {
        generation.current++;
        const current = session.current;
        session.current = null;
        if (current) {
            if (current.timer) clearTimeout(current.timer);
            if (current.cursor) clearInterval(current.cursor);
            const now = context.current?.currentTime ?? 0;
            try {
                current.master.gain.cancelScheduledValues(now);
                current.master.gain.setValueAtTime(current.master.gain.value, now);
                current.master.gain.linearRampToValueAtTime(0, now + FADE);
            } catch { /* AudioContext may already be closed. */ }
            for (const source of current.sources) {
                try { source.stop(now + FADE); } catch { /* Already ended. */ }
            }
        }
        setActive(null); setNoteIndex(null); setLoading(false); setError("");
    }, []);

    const play = useCallback(async (raw: string, candidateIndex: number) => {
        stop();
        const id = generation.current;
        setActive(candidateIndex); setLoading(true);
        try {
            const AudioConstructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioConstructor) throw new Error("Браузер не поддерживает воспроизведение звука.");
            const audio = context.current ?? new AudioConstructor();
            context.current = audio;
            // Resume immediately within the user's click, before loading the parser.
            const [parsed] = await Promise.all([createPlaybackPlan(raw, bpm, semitones), audio.resume()]);
            if (generation.current !== id) return;
            if (!parsed.value) {
                const unmeasured = parsed.diagnostics.some(d => d.code === "UNMEASURED_DURATION");
                throw new Error(unmeasured ? "Речитация не имеет заданной длительности. Такой вариант пока нельзя прослушать." : "Не удалось прочитать все ноты для воспроизведения.");
            }
            if (audio.state !== "running") throw new Error("Звук заблокирован браузером. Повторите нажатие «Послушать».");
            const plan = parsed.value;
            const master = audio.createGain();
            master.gain.value = .18;
            master.connect(audio.destination);
            const current: Session = { sources: [], master, timer: null, cursor: null };
            session.current = current;
            const begin = audio.currentTime + LEAD;
            let remaining = plan.tones.length;
            for (const tone of plan.tones) {
                const source = audio.createOscillator();
                const envelope = audio.createGain();
                current.sources.push(source);
                source.type = "triangle";
                source.frequency.value = tone.hz;
                const at = begin + tone.start;
                const till = at + tone.soundingDuration;
                const attack = Math.min(.02, tone.soundingDuration / 4);
                const release = Math.min(.06, tone.soundingDuration / 4);
                envelope.gain.setValueAtTime(0, at);
                envelope.gain.linearRampToValueAtTime(1, at + attack);
                envelope.gain.setValueAtTime(1, till - release);
                envelope.gain.linearRampToValueAtTime(0, till);
                source.connect(envelope); envelope.connect(master);
                source.onended = () => {
                    source.disconnect(); envelope.disconnect();
                    if (--remaining === 0) master.disconnect();
                };
                source.start(at); source.stop(till + .01);
            }
            current.cursor = setInterval(() => {
                if (generation.current !== id) return;
                const elapsed = audio.currentTime - begin;
                const index = plan.tones.findIndex(tone => elapsed >= tone.start && elapsed < tone.start + tone.duration);
                setNoteIndex(index < 0 ? null : index);
            }, 40);
            current.timer = setTimeout(() => { if (generation.current === id) stop(); }, (LEAD + plan.duration + .1) * 1000);
            setLoading(false);
        } catch (cause) {
            if (generation.current !== id) return;
            stop(); setError(cause instanceof Error ? cause.message : "Не удалось воспроизвести мелодию.");
        }
    }, [bpm, semitones, stop]);

    useEffect(() => () => {
        stop();
        const audio = context.current;
        context.current = null;
        if (audio && audio.state !== "closed") void audio.close().catch(() => {});
    }, [stop]);

    return { play, stop, active, noteIndex, loading, error };
}
