'use client';
import { useEffect, useState } from "react";
import { getNeumeGraphics, groupNeumeGraphics, type NeumeGraphicPart } from "@/lib/kruczie/neumeGraphics";
import type { Melody } from "@znamenica/kruczie/melody";
import { displayNotes, type NoteStyle } from "@/lib/kruczie/notation";
import styles from "./notation.module.css";
import { useNoteDisplay } from "./NoteDisplay";

function GraphicPart({ part }: { part: NeumeGraphicPart }) {
    if (part.kind === "unknown") return <span className={styles.unknown} title={`Неизвестное обозначение: ${part.raw}`}>{part.raw}</span>;
    if (part.kind === "empty") return <span className={styles.empty} aria-label="Пустая крюковая позиция" />;
    if (part.kind === "cue") return <span className={styles.cue}>{part.children?.map((child, i) => <GraphicPart key={i} part={child} />)}</span>;
    return <>{part.unicode}</>;
}
export function Neumes({ unicode, notation, compact = false }: { unicode: string; notation?: string; compact?: boolean }) {
    const [rendering, setRendering] = useState<{ raw: string; parts: readonly NeumeGraphicPart[] }>();
    useEffect(() => {
        if (notation === undefined) return;
        let cancelled = false;
        getNeumeGraphics(notation).then(parts => { if (!cancelled && parts) setRendering({ raw: notation, parts }); }).catch(() => { /* Keep the already converted layer available. */ });
        return () => { cancelled = true; };
    }, [notation]);
    const parts = rendering && rendering.raw === notation ? rendering.parts : undefined;
    return <div className={`${styles.neumes} overflow-x-auto`} style={compact ? { fontSize: 42 } : undefined} role="img" aria-label={`Крюковая запись${notation ? `: ${notation}` : ""}`}>
        {parts ? groupNeumeGraphics(parts).map(({ cue, body }, i) => body.kind === "separator" ? <GraphicPart key={i} part={body} /> : <span className={styles.compound} key={i} title={body.raw}>
            <span className={styles.cueRow}>{cue.map((part, j) => <GraphicPart key={j} part={part} />)}</span>
            <span className={styles.neumeBody}><GraphicPart part={body} /></span>
        </span>) : unicode}
    </div>;
}
export function Notes({ melody, style, activeNote = null, compact = false }: { melody: Melody; style: NoteStyle; activeNote?: number | null; compact?: boolean }) {
    const { octave } = useNoteDisplay();
    const events = melody.events ?? [];
    const notes = displayNotes(events, style, octave);
    const warnings = [...new Set(notes.flatMap(n => n.warning ? [n.warning] : []))];
    if (events.some(e => e.kind === "unknown")) warnings.push("Неизвестные обозначения сохранены в исходной строке.");
    const startX = compact ? 24 : 70;
    const width = Math.max(compact ? 130 : 260, notes.length * 48 + (compact ? 50 : 100));
    const top = Math.min(0, ...notes.map(n => n.y - 45));
    const bottom = Math.max(135, ...notes.map(n => n.y + 45));
    return <div>
        <div className="overflow-x-auto" tabIndex={0} aria-label="Прокрутка нотной записи">
            <svg width={width} height={bottom - top} viewBox={`0 ${top} ${width} ${bottom - top}`} role="img"
                aria-label={`${style === "round" ? "Круглая нотация" : "Киевская квадратная нотация"}, скрипичный ключ${octave === -1 ? ", запись на октаву ниже звучания" : ""}`}>
                <title>{style === "round" ? "Круглые ноты" : "Киевские квадратные ноты"}: {events.filter(e => e.kind === "note" || e.kind === "reciting").map(e => `${e.pitch.step}${e.pitch.alteration === 1 ? "#" : e.pitch.alteration === -1 ? "b" : ""}${e.pitch.octave + octave}`).join(" ")}</title>
                {[50, 60, 70, 80, 90].map(y => <line key={y} x1={8} x2={width - 8} y1={y} y2={y} stroke="#64748b" strokeWidth={.7} />)}
                <g className={styles.music} fontSize={40} fill="currentColor">
                    {!compact && <><text x={16} y={80}>{"\uE050"}</text>{octave === -1 && <text x={27} y={32} fontSize={13} fontFamily="serif">8</text>}</>}
                    {notes.map((note, i) => <g key={i}>
                        {activeNote === i && <rect x={startX + i * 48 - 6} y={note.y - 37} width={32} height={76} rx={4} fill="#fef3c7" stroke="#b45309" strokeWidth={1} />}
                        {note.ledgers.map(y => <line key={y} x1={startX + i * 48 - 4} x2={startX + i * 48 + 21} y1={y} y2={y} stroke="currentColor" strokeWidth={1} />)}
                        {note.accidental && <text x={startX + i * 48 - 17} y={note.y}>{note.accidental}</text>}
                        {note.glyph ? <text x={startX + i * 48} y={note.y}>{note.glyph}</text>
                            : <text x={startX + i * 48} y={note.y} fontFamily="monospace" fontSize={12}>{note.raw}</text>}
                        {note.dot && note.glyph && <text x={startX + i * 48 + 19} y={note.y + ((note.y - 50) % 10 === 0 ? -5 : 0)}>{style === "kievan" ? "\uEC3C" : "\uE1E7"}</text>}
                    </g>)}
                </g>
            </svg>
        </div>
        {events.some(e => e.kind === "mark" && (e.mark === "bar" || e.mark === "end" || e.mark.startsWith("bracket"))) && <p className="text-xs text-slate-500">Разделители и скобки сохранены в строке под станом.</p>}
        {warnings.map(w => <p key={w} className="text-xs text-amber-800">{w}</p>)}
    </div>;
}
