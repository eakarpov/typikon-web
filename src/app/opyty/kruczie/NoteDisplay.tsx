"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
export type DisplayOctave = -1 | 0;
const NoteDisplayContext = createContext<{ octave: DisplayOctave; setOctave: (value: DisplayOctave) => void }>({ octave: -1, setOctave: () => {} });
export function NoteDisplayProvider({ children }: { children: ReactNode }) {
    const [octave, setOctave] = useState<DisplayOctave>(-1);
    return <NoteDisplayContext.Provider value={{ octave, setOctave }}>{children}</NoteDisplayContext.Provider>;
}
export const useNoteDisplay = () => useContext(NoteDisplayContext);
export function NoteDisplayControl() {
    const { octave, setOctave } = useNoteDisplay();
    return <div className="text-sm">
        <label>Октава на стане <select className="border border-slate-300 rounded px-3 py-2 bg-white text-slate-900" value={octave} onChange={e => setOctave(Number(e.target.value) as DisplayOctave)}>
            <option value={-1}>На октаву ниже</option><option value={0}>Исходная</option>
        </select></label>
        <p className="text-xs text-slate-500 mt-1">{octave === -1 ? "Ноты записаны на октаву ниже звучания (8va)." : "Ноты записаны на высоте звучания."} Звучание и экспорт задаются опорной ступенью.</p>
    </div>;
}
