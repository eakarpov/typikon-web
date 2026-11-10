import { isFootnoteBook } from "@/utils/texts";
import { footnoteKey, footnoteMarkers, footnoteText, type FootnoteDocument } from "./footnoteEditing";
export { footnoteKey } from "./footnoteEditing";

/** Stored IDs are stable; these labels follow the order in which a reader meets them. */
export function footnoteNumbers(doc: FootnoteDocument, numberCitations = false): Record<string, number> {
    const numbers: Record<string, number> = {};
    let next = 1;
    const add = (key: string, note: string) => {
        // Biblical references are displayed as citations, not numbered endnotes.
        if (!note.trim() || (!numberCitations && isFootnoteBook(note).isBook) || numbers[key]) return;
        numbers[key] = next++;
    };
    // Poems are printed in the reading header, before the body.
    for (const field of ["poems", "content"] as const) {
        for (const marker of footnoteMarkers(doc[field], field)) add(footnoteKey(doc, marker.target), footnoteText(doc, marker.target));
    }
    // Preserve legacy explanations without markers at the end of the list.
    doc.footnotes.forEach((note, i) => add(String(i + 1), note));
    return numbers;
}

export function orderedFootnotes(footnotes: string[], numbers: Record<string, number>) {
    return footnotes.map((text, i) => ({ id: i + 1, text, number: numbers[String(i + 1)] }))
        .filter(note => note.text.trim() && note.number != null)
        .sort((a, b) => a.number - b.number);
}
