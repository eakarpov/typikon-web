"use client";
import React, { useMemo, useRef, useState } from "react";
import Modal from "react-modal";
import { deleteFootnote, editFootnote, insertFootnote, footnoteMarkers, footnoteText,
    type FootnoteDocument, type FootnoteField, type FootnoteTarget, type FootnoteInsertion } from "@/lib/markup/footnoteEditing";
import { footnoteKey, footnoteNumbers } from "@/lib/markup/footnoteNumbers";

const button = "border rounded px-3 py-2 min-h-11 disabled:opacity-50";

export default function useFootnoteEditor(doc: FootnoteDocument, onChange: (value: FootnoteDocument) => void, disabled = false) {
    const { content, poems, footnotes } = doc;
    const numbers = useMemo(() => footnoteNumbers({ content, poems, footnotes }), [content, poems, footnotes]);
    const markersByField = useMemo(() => ({ content: footnoteMarkers(content, "content"), poems: footnoteMarkers(poems, "poems") }), [content, poems]);
    const referenceCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const marker of [...markersByField.content, ...markersByField.poems]) {
            const key = footnoteKey({ content, poems, footnotes }, marker.target);
            counts[key] = (counts[key] ?? 0) + 1;
        }
        return counts;
    }, [markersByField, content, poems, footnotes]);
    const [target, setTarget] = useState<FootnoteTarget | null>(null);
    const [insertion, setInsertion] = useState<(FootnoteInsertion & { element?: HTMLTextAreaElement }) | null>(null);
    const carets = useRef<Partial<Record<FootnoteField, FootnoteInsertion & { element: HTMLTextAreaElement }>>>({});
    const [draft, setDraft] = useState("");
    const [error, setError] = useState("");
    const open = (next: FootnoteTarget) => {
        if (disabled) return;
        try { setDraft(footnoteText(doc, next)); setInsertion(null); setTarget(next); setError(""); }
        catch (e) { setError((e as Error).message); }
    };
    const close = () => { setTarget(null); setInsertion(null); setError(""); };
    const apply = (remove = false) => {
        if (insertion && !disabled) {
            try {
                const next = insertFootnote(doc, insertion, draft);
                const offset = insertion.offset + next[insertion.field].length - insertion.source.length;
                const { element, field } = insertion;
                onChange(next);
                close();
                // Restore the caret after React updates the controlled textarea and closes the dialog.
                requestAnimationFrame(() => {
                    if (!element?.isConnected) return;
                    element.focus();
                    element.setSelectionRange(offset, offset);
                    carets.current[field] = { field, offset, source: next[field], element };
                });
            } catch (e) { setError((e as Error).message); }
            return;
        }
        if (!target || disabled) return;
        try { onChange(remove ? deleteFootnote(doc, target) : editFootnote(doc, target, draft)); close(); }
        catch (e) { setError((e as Error).message); }
    };
    const openAt = (field: FootnoteField, offset: number) => {
        const marker = markersByField[field].find(mark => offset >= mark.start && offset < mark.end);
        if (marker) open(marker.target);
    };
    const remember = (field: FootnoteField, element: HTMLTextAreaElement) => {
        carets.current[field] = { field, offset: element.selectionEnd, source: element.value, element };
    };
    const sourceProps = (field: FootnoteField) => ({
        disabled,
        onFocus: (event: React.FocusEvent<HTMLTextAreaElement>) => remember(field, event.currentTarget),
        onBlur: (event: React.FocusEvent<HTMLTextAreaElement>) => remember(field, event.currentTarget),
        onSelect: (event: React.SyntheticEvent<HTMLTextAreaElement>) => remember(field, event.currentTarget),
        onClick: (event: React.MouseEvent<HTMLTextAreaElement>) => { remember(field, event.currentTarget); openAt(field, event.currentTarget.selectionStart); },
        onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.altKey && event.key === "Enter") { event.preventDefault(); openAt(field, event.currentTarget.selectionStart); }
        },
    });
    const insertButton = (field: FootnoteField) => <button type="button" className={button} disabled={disabled}
        aria-label={field === "poems" ? "Вставить сноску в стихи" : "Вставить сноску в текст"}
        title="В последнюю позицию курсора; после выделенного фрагмента. Если курсор ещё не установлен — в конец поля."
        onClick={() => {
            const caret = carets.current[field];
            if (caret && caret.source !== doc[field]) { setError("Установите курсор в нужном месте текста заново."); return; }
            setInsertion(caret ?? { field, offset: doc[field].length, source: doc[field] });
            setTarget(null); setDraft(""); setError("");
        }}>Вставить сноску</button>;
    const preview = (field: FootnoteField) => {
        const markers = markersByField[field];
        if (!markers.length) return null;
        const pieces: React.ReactNode[] = [];
        let from = 0;
        markers.forEach((marker, i) => {
            pieces.push(doc[field].slice(from, marker.start));
            const label = String(numbers[footnoteKey(doc, marker.target)] ?? "ссылка");
            pieces.push(<button type="button" disabled={disabled} key={i} onClick={() => open(marker.target)}
                className="inline-flex rounded border border-red-300 px-1 text-red-800 underline min-h-8"
                aria-label={`Редактировать сноску ${label}`} title={footnoteText(doc, marker.target)}>[{label}]</button>);
            from = marker.end;
        });
        pieces.push(doc[field].slice(from));
        return <details className="my-2" open>
            <summary className="cursor-pointer py-2">{field === "poems" ? "Сноски в стихах" : "Сноски в тексте"} — нажмите на метку</summary>
            <div className="whitespace-pre-wrap border rounded p-3 max-h-72 overflow-auto">{pieces}</div>
        </details>;
    };
    const count = target ? referenceCounts[footnoteKey(doc, target)] ?? 0 : 0;
    const number = target ? numbers[footnoteKey(doc, target)] : null;
    const title = number ? `Сноска ${number}` : target?.kind === "number" ? "Сноска" : "Новая сноска";
    const active = doc.footnotes.map((text, i) => ({ text, id: i + 1 })).filter(note => note.text.trim())
        .sort((a, b) => (numbers[String(a.id)] ?? Infinity) - (numbers[String(b.id)] ?? Infinity));
    return {
        isOpen: target !== null || insertion !== null,
        sourceProps,
        insertButton,
        preview,
        renderNumber: (id: string) => <button type="button" disabled={disabled} className="text-red-800 underline"
            aria-label={`Редактировать сноску ${numbers[id] ?? "ссылку"}`} onClick={() => open({ kind: "number", number: Number(id) })}>
            [{numbers[id] ?? "ссылка"}]</button>,
        controls: <>
            <p className="text-sm">Для новой сноски поставьте курсор в тексте или стихах и нажмите «Вставить сноску». При выделении текста метка вставится после него. Для изменения или удаления нажмите на метку; с клавиатуры — Alt+Enter. Видимые номера рассчитываются по порядку появления.</p>
            <details><summary className="cursor-pointer py-2">Все сохранённые сноски ({active.length})</summary>
                <ul>{active.map(note => <li key={note.id}><button type="button" disabled={disabled}
                    className="text-left underline min-h-11 py-2" onClick={() => open({ kind: "number", number: note.id })}>
                    [{numbers[String(note.id)] ?? "ссылка"}] {note.text}{!referenceCounts[String(note.id)] && " (без меток)"}
                </button></li>)}</ul>
            </details>
            {!target && !insertion && error && <p role="alert">{error}</p>}
            <Modal isOpen={!!target || !!insertion} onRequestClose={close} contentLabel={insertion ? "Новая сноска" : title}
                style={{ overlay: { zIndex: 100 }, content: { maxWidth: "42rem", maxHeight: "85vh", margin: "auto", height: "fit-content" } }}>
                <div className="space-y-4">
                    <h2 className="font-bold text-lg">{insertion ? "Новая сноска" : title}</h2>
                    <p>{insertion ? `Метка будет вставлена в ${insertion.field === "poems" ? "стихи" : "текст"} в выбранную позицию.` : count ? `Метки в тексте и стихах: ${count}. Изменение применяется ко всем меткам этой сноски.` : "У этой сноски нет меток в тексте или стихах."}</p>
                    <label className="block">Текст сноски<textarea autoFocus className="block w-full min-h-36 border p-2" value={draft} onChange={event => setDraft(event.target.value)} /></label>
                    {error && <p role="alert" className="text-red-800">{error}</p>}
                    <p className="text-sm">{!insertion && "Удаление уберёт сноску и все её метки из текста и стихов. Связи остальных сносок сохранятся; видимые номера пересчитаются. "}Изменения вступят в силу после сохранения текста.</p>
                    <div className="flex gap-3 flex-wrap">
                        <button type="button" className={button} disabled={disabled} onClick={() => apply()}>{insertion ? "Вставить" : "Применить"}</button>
                        <button type="button" className={button} onClick={close}>Отмена</button>
                        {!insertion && <button type="button" className={`${button} text-red-800`} disabled={disabled} onClick={() => apply(true)}>Удалить сноску</button>}
                    </div>
                </div>
            </Modal>
        </>,
    };
}
