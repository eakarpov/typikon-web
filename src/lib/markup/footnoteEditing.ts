export interface FootnoteDocument { content: string; poems: string; footnotes: string[] }
export type FootnoteField = "content" | "poems";
export interface FootnoteInsertion { field: FootnoteField; offset: number; source: string }
export type FootnoteTarget = { kind: "number"; number: number }
    | { kind: "inline"; field: FootnoteField; start: number; raw: string };

function insertMarker(doc: FootnoteDocument, location: FootnoteInsertion, marker: string): FootnoteDocument {
    const source = doc[location.field];
    if (source !== location.source) throw new Error("Текст изменился. Закройте окно и установите курсор заново.");
    if (!Number.isInteger(location.offset) || location.offset < 0 || location.offset > source.length) throw new Error("Установите курсор в тексте или стихах.");
    const before = source.slice(0, location.offset);
    if (before.lastIndexOf("{") > before.lastIndexOf("}")) throw new Error("Поставьте курсор вне метки разметки, чтобы вставить сноску.");
    return { ...doc, [location.field]: before + marker + source.slice(location.offset) };
}

export function insertFootnote(doc: FootnoteDocument, location: FootnoteInsertion, value: string): FootnoteDocument {
    const note = value.trim();
    if (!note) throw new Error("Введите текст сноски.");
    if (/[{}]/.test(note)) throw new Error("В новой сноске нельзя использовать фигурные скобки.");
    return insertMarker(doc, location, `{fn|${note}}`);
}

export function insertFootnoteReference(doc: FootnoteDocument, location: FootnoteInsertion, target: FootnoteTarget): FootnoteDocument {
    const note = footnoteText(doc, target);
    if (!note.trim()) throw new Error("Выбранная сноска удалена или не содержит пояснения. Выберите другую.");
    const key = footnoteKey(doc, target);
    // Saved notes are referenced by their exact ID, even when two notes have identical text.
    // Unsaved inline notes compile to a shared ID when the document is saved.
    const marker = target.kind === "number" || !key.startsWith("new:") ? `{${key}}` : `{fn|${note}}`;
    return insertMarker(doc, location, marker);
}

export interface FootnoteChoice { key: string; target: FootnoteTarget; text: string }

export function footnoteChoices(doc: FootnoteDocument): FootnoteChoice[] {
    const choices = new Map<string, FootnoteChoice>();
    doc.footnotes.forEach((text, i) => {
        if (text.trim()) choices.set(String(i + 1), { key: String(i + 1), target: { kind: "number", number: i + 1 }, text });
    });
    for (const field of ["poems", "content"] as const) {
        for (const marker of footnoteMarkers(doc[field], field)) {
            const text = footnoteText(doc, marker.target);
            const key = footnoteKey(doc, marker.target);
            if (text.trim() && !choices.has(key)) choices.set(key, { key, target: marker.target, text });
        }
    }
    return [...choices.values()];
}

export function footnoteMarkers(source: string, field: FootnoteField) {
    return [...source.matchAll(/\{fn\|[^{}]*\}|\{\d+\}/g)].map(match => ({
        start: match.index!, end: match.index! + match[0].length, raw: match[0],
        target: (match[0].startsWith("{fn|")
            ? { kind: "inline", field, start: match.index!, raw: match[0] }
            : { kind: "number", number: Number(match[0].slice(1, -1)) }) as FootnoteTarget,
    })).filter(marker => marker.target.kind === "inline" || (Number.isSafeInteger(marker.target.number) && marker.target.number > 0));
}

function checkNumber(number: number) {
    if (!Number.isSafeInteger(number) || number < 1) throw new Error("Неверный номер сноски.");
}

function checkInline(doc: FootnoteDocument, target: Extract<FootnoteTarget, { kind: "inline" }>) {
    if (doc[target.field].slice(target.start, target.start + target.raw.length) !== target.raw) {
        throw new Error("Текст изменился. Закройте окно и откройте сноску заново.");
    }
}

export function footnoteText(doc: FootnoteDocument, target: FootnoteTarget): string {
    if (target.kind === "inline") { checkInline(doc, target); return target.raw.slice(4, -1).trim(); }
    checkNumber(target.number);
    return doc.footnotes[target.number - 1] ?? "";
}

export function footnoteReferenceCount(doc: FootnoteDocument, number: number) {
    checkNumber(number);
    return footnoteTargetCount(doc, { kind: "number", number });
}

export function footnoteKey(doc: FootnoteDocument, target: FootnoteTarget): string {
    if (target.kind === "number") return String(target.number);
    const text = footnoteText(doc, target);
    const existing = doc.footnotes.indexOf(text);
    return existing >= 0 ? String(existing + 1) : `new:${text}`;
}

export function footnoteTargetCount(doc: FootnoteDocument, target: FootnoteTarget): number {
    const key = footnoteKey(doc, target);
    return (["content", "poems"] as const).reduce((sum, field) => sum + footnoteMarkers(doc[field], field)
        .filter(marker => footnoteKey(doc, marker.target) === key).length, 0);
}

function rewriteReferences(doc: FootnoteDocument, target: FootnoteTarget, replacement: string, onlyInline = false) {
    const key = footnoteKey(doc, target);
    const next = { ...doc };
    for (const field of ["content", "poems"] as const) {
        for (const marker of footnoteMarkers(doc[field], field).reverse()) {
            if ((!onlyInline || marker.target.kind === "inline") && footnoteKey(doc, marker.target) === key) {
                next[field] = next[field].slice(0, marker.start) + replacement + next[field].slice(marker.end);
            }
        }
    }
    return next;
}

export function editFootnote(doc: FootnoteDocument, target: FootnoteTarget, value: string): FootnoteDocument {
    const note = value.trim();
    if (!note) throw new Error("Введите текст сноски. Для удаления используйте кнопку «Удалить сноску».");
    if (target.kind === "inline") {
        checkInline(doc, target);
        const existing = doc.footnotes.indexOf(footnoteText(doc, target));
        if (existing >= 0) return editFootnote(doc, { kind: "number", number: existing + 1 }, note);
        if (/[{}]/.test(note)) throw new Error("В новой сноске нельзя использовать фигурные скобки.");
        return rewriteReferences(doc, target, `{fn|${note}}`);
    }
    checkNumber(target.number);
    if (target.number > doc.footnotes.length) throw new Error("Сноска с таким номером отсутствует в тексте.");
    const footnotes = [...doc.footnotes];
    footnotes[target.number - 1] = note;
    return { ...rewriteReferences(doc, target, `{${target.number}}`, true), footnotes };
}

export function deleteFootnote(doc: FootnoteDocument, target: FootnoteTarget): FootnoteDocument {
    if (target.kind === "inline") {
        checkInline(doc, target);
        const existing = doc.footnotes.indexOf(footnoteText(doc, target));
        return existing >= 0 ? deleteFootnote(doc, { kind: "number", number: existing + 1 }) : rewriteReferences(doc, target, "");
    }
    checkNumber(target.number);
    const footnotes = [...doc.footnotes];
    // Tombstone, never splice: existing numbers and external anchors stay stable.
    // New notes append after this slot; they cannot take over a deleted note's ID.
    if (target.number <= footnotes.length) footnotes[target.number - 1] = "";
    return { ...rewriteReferences(doc, target, ""), footnotes };
}
