"use client";
import React, { createContext, useContext, useMemo } from "react";
import { footnoteNumbers, orderedFootnotes } from "@/lib/markup/footnoteNumbers";

const Numbers = createContext<Record<string, number> | null>(null);
export const useFootnoteNumbers = () => useContext(Numbers);

export default function FootnoteScope({ content = "", poems = "", footnotes = [], numberCitations = false, numbering, children }: {
    content?: string; poems?: string; footnotes?: string[]; numberCitations?: boolean; numbering?: Record<string, number>; children?: React.ReactNode;
}) {
    const numbers = useMemo(() => numbering ?? footnoteNumbers({ content, poems, footnotes }, numberCitations), [content, poems, footnotes, numberCitations, numbering]);
    return <Numbers.Provider value={numbers}>{children}</Numbers.Provider>;
}

export function FootnoteList({ footnotes = [] }: { footnotes?: string[] }) {
    const context = useFootnoteNumbers();
    const numbers = context ?? footnoteNumbers({ content: "", poems: "", footnotes });
    const notes = orderedFootnotes(footnotes, numbers);
    if (!notes.length) return null;
    return <div className="font-serif"><p><strong>Сноски:</strong></p>
        {notes.map(note => <p key={note.id} id={`footnotes-${note.id}`} className="whitespace-pre-wrap">{note.number} {note.text}</p>)}
    </div>;
}
