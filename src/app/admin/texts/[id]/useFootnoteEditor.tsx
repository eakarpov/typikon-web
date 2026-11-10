"use client";
import React, { useMemo, useState } from "react";
import Modal from "react-modal";
import { deleteFootnote, editFootnote, footnoteMarkers, footnoteText,
    type FootnoteDocument, type FootnoteField, type FootnoteTarget } from "@/lib/markup/footnoteEditing";
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
    const [draft, setDraft] = useState("");
    const [error, setError] = useState("");
    const open = (next: FootnoteTarget) => {
        if (disabled) return;
        try { setDraft(footnoteText(doc, next)); setTarget(next); setError(""); }
        catch (e) { setError((e as Error).message); }
    };
    const close = () => { setTarget(null); setError(""); };
    const apply = (remove = false) => {
        if (!target || disabled) return;
        try { onChange(remove ? deleteFootnote(doc, target) : editFootnote(doc, target, draft)); close(); }
        catch (e) { setError((e as Error).message); }
    };
    const openAt = (field: FootnoteField, offset: number) => {
        const marker = markersByField[field].find(mark => offset >= mark.start && offset <= mark.end);
        if (marker) open(marker.target);
    };
    const sourceProps = (field: FootnoteField) => ({
        disabled,
        onClick: (event: React.MouseEvent<HTMLTextAreaElement>) => openAt(field, event.currentTarget.selectionStart),
        onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.altKey && event.key === "Enter") { event.preventDefault(); openAt(field, event.currentTarget.selectionStart); }
        },
    });
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
        isOpen: target !== null,
        sourceProps,
        preview,
        renderNumber: (id: string) => <button type="button" disabled={disabled} className="text-red-800 underline"
            aria-label={`Редактировать сноску ${numbers[id] ?? "ссылку"}`} onClick={() => open({ kind: "number", number: Number(id) })}>
            [{numbers[id] ?? "ссылка"}]</button>,
        controls: <>
            <p className="text-sm">Новая сноска: <code>{"{fn|Текст сноски}"}</code>. Для изменения или удаления нажмите на метку в тексте, стихах или предпросмотре. С клавиатуры — Alt+Enter на метке. Видимые номера рассчитываются по порядку появления; метки в исходнике менять не нужно.</p>
            <details><summary className="cursor-pointer py-2">Все сохранённые сноски ({active.length})</summary>
                <ul>{active.map(note => <li key={note.id}><button type="button" disabled={disabled}
                    className="text-left underline min-h-11 py-2" onClick={() => open({ kind: "number", number: note.id })}>
                    [{numbers[String(note.id)] ?? "ссылка"}] {note.text}{!referenceCounts[String(note.id)] && " (без меток)"}
                </button></li>)}</ul>
            </details>
            {!target && error && <p role="alert">{error}</p>}
            <Modal isOpen={!!target} onRequestClose={close} contentLabel={title}
                style={{ overlay: { zIndex: 100 }, content: { maxWidth: "42rem", maxHeight: "85vh", margin: "auto", height: "fit-content" } }}>
                <div className="space-y-4">
                    <h2 className="font-bold text-lg">{title}</h2>
                    <p>{count ? `Метки в тексте и стихах: ${count}. Изменение применяется ко всем меткам этой сноски.` : "У этой сноски нет меток в тексте или стихах."}</p>
                    <label className="block">Текст сноски<textarea autoFocus className="block w-full min-h-36 border p-2" value={draft} onChange={event => setDraft(event.target.value)} /></label>
                    {error && <p role="alert" className="text-red-800">{error}</p>}
                    <p className="text-sm">Удаление уберёт сноску и все её метки из текста и стихов. Связи остальных сносок сохранятся; видимые номера пересчитаются. Изменения вступят в силу после сохранения текста.</p>
                    <div className="flex gap-3 flex-wrap">
                        <button type="button" className={button} disabled={disabled} onClick={() => apply()}>Применить</button>
                        <button type="button" className={button} onClick={close}>Отмена</button>
                        <button type="button" className={`${button} text-red-800`} disabled={disabled} onClick={() => apply(true)}>Удалить сноску</button>
                    </div>
                </div>
            </Modal>
        </>,
    };
}
