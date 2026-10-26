import type { Melody } from "@znamenica/kruczie/melody";
import { displayNotes, type NoteStyle } from "@/lib/kruczie/notation";
import styles from "./notation.module.css";

export function Neumes({ unicode, compact = false }: { unicode: string; compact?: boolean }) {
    return <div className={`${styles.neumes} overflow-x-auto`} style={compact ? { fontSize: 42, minHeight: 90 } : undefined} role="img" aria-label="Крюковая запись">{unicode}</div>;
}
export function Notes({ melody, style, activeNote = null, compact = false }: { melody: Melody; style: NoteStyle; activeNote?: number | null; compact?: boolean }) {
    const events = melody.events ?? [];
    const notes = displayNotes(events, style);
    const warnings = [...new Set(notes.flatMap(n => n.warning ? [n.warning] : []))];
    if (events.some(e => e.kind === "unknown")) warnings.push("Неизвестные обозначения сохранены в исходной строке.");
    const startX = compact ? 24 : 70;
    const width = Math.max(compact ? 130 : 260, notes.length * 48 + (compact ? 50 : 100));
    const top = Math.min(0, ...notes.map(n => n.y - 45));
    const bottom = Math.max(135, ...notes.map(n => n.y + 45));
    return <div>
        <div className="overflow-x-auto" tabIndex={0} aria-label="Прокрутка нотной записи">
            <svg width={width} height={bottom - top} viewBox={`0 ${top} ${width} ${bottom - top}`} role="img"
                aria-label={style === "round" ? "Круглая нотация, скрипичный ключ" : "Киевская квадратная нотация, скрипичный ключ"}>
                <title>{style === "round" ? "Круглые ноты" : "Киевские квадратные ноты"}: {events.filter(e => e.kind === "note" || e.kind === "reciting").map(e => `${e.pitch.step}${e.pitch.alteration === 1 ? "#" : e.pitch.alteration === -1 ? "b" : ""}${e.pitch.octave}`).join(" ")}</title>
                {[50, 60, 70, 80, 90].map(y => <line key={y} x1={8} x2={width - 8} y1={y} y2={y} stroke="#64748b" strokeWidth={.7} />)}
                <g className={styles.music} fontSize={40} fill="currentColor">
                    {!compact && <text x={16} y={80}>{"\uE050"}</text>}
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
