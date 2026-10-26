'use client';
import { useEffect, useState } from "react";
import type { Melody } from "@znamenica/kruczie";
import type { MusicLayers } from "@/lib/kruczie/znamen";
import type { NotationShift } from "@/lib/kruczie/transposition";
import { shiftedMelody } from "@/lib/kruczie/transposition";
import { Neumes, Notes } from "./Notation";
import type { NoteStyle } from "@/lib/kruczie/notation";
export default function TransposedScore({ notation, unicode, melody, shift, style, activeNote, compact = false }: {
    notation?: string; unicode: string; melody?: Melody; shift: NotationShift; style: NoteStyle; activeNote: number | null; compact?: boolean;
}) {
    const [result, setResult] = useState<{ key: string; layers?: MusicLayers; unicode?: string; error?: string } | null>(null);
    const { semitones, tradition, tone } = shift;
    const key = JSON.stringify([notation, melody?.raw, semitones, tradition, tone]);
    useEffect(() => {
        if (!semitones) return;
        let cancelled = false;
        import("@/lib/kruczie/transposition").then(api => api.transposeLayers({ notation, melody: melody?.raw }, { semitones, tradition, tone })).then(async layers => {
            const { convertNeumes } = await import("@znamenica/kruczie");
            if (!cancelled) setResult({ key, layers, unicode: layers.notation ? convertNeumes(layers.notation).value?.unicode : "" });
        }).catch(cause => { if (!cancelled) setResult({ key, error: cause.message }); });
        return () => { cancelled = true; };
    }, [key, notation, melody?.raw, semitones, tradition, tone]);
    const current = shift.semitones ? result?.key === key ? result : null : { layers: { notation, melody: melody?.raw }, unicode, error: undefined };
    return <>
        {notation !== undefined && <>{current?.unicode ? <Neumes unicode={current.unicode} compact={compact} /> : !shift.semitones ? <Neumes unicode={unicode} compact={compact} /> : null}
        <pre className="font-mono text-xs whitespace-pre-wrap">{current?.layers?.notation ?? (shift.semitones ? "Перенос крюковых помет не подтверждён" : notation)}</pre></>}
        {melody && <><Notes melody={shiftedMelody(melody, shift.semitones)} style={style} activeNote={activeNote} compact={compact} />
        <pre className="font-mono text-xs whitespace-pre-wrap">{current?.layers?.melody ?? (shift.semitones ? "Ноты показаны в выбранной высоте; текстовый экспорт требует проверки" : melody.raw)}</pre></>}
        {shift.semitones !== 0 && !current && <p className="text-xs" role="status">Проверяем перенос…</p>}
        {current?.error && <p className="text-xs text-amber-800" role="alert">{current.error} Экспорт в выбранной высоте заблокирован.</p>}
    </>;
}
