'use client';
import type { NotationShift } from "@/lib/kruczie/transposition";
import { useEffect, useRef, useState } from "react";
import type { ZnamenFile } from "@znamenica/kruczie/formats/znamen";
import type { ImportedZnamen, MusicLayers, ZnamenExport } from "@/lib/kruczie/znamen";

import { looksLikeEscapedZnamen, unescapeZnamenPaste } from "@/lib/kruczie/transport";

import { diagnosticText } from "@/lib/kruczie/diagnostics";

interface Props {
    mode: "import" | "export";
    source: ImportedZnamen | null;
    layers: MusicLayers;
    onImport: (source: ImportedZnamen, layer: "notation" | "melody", input: string) => void;
    onClose: () => void;
    onImportWork?: (raw: string) => void;
    documentRaw?: string;
    shift?: NotationShift;
}
const control = "border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 disabled:opacity-50";
export default function ZnamenDialog({ mode, source, layers, onImport, onClose, onImportWork, documentRaw, shift }: Props) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [text, setText] = useState(mode === "import" ? source?.raw ?? "" : "");
    const [originalPaste, setOriginalPaste] = useState<string | null>(null);
    const [file, setFile] = useState<ZnamenFile | null>(null);
    const [blockIndex, setBlockIndex] = useState(0);
    const [layer, setLayer] = useState<"notation" | "melody">("notation");
    const [useSource, setUseSource] = useState(!!source);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [exported, setExported] = useState<ZnamenExport | null>(null);
    const block = file?.blocks[blockIndex];
    useEffect(() => {
        const element = dialog.current;
        const opener = document.activeElement;
        element?.showModal();
        element?.querySelector("textarea")?.focus();
        return () => {
            if (element?.open) element.close();
            if (opener instanceof HTMLElement) opener.focus();
        };
    }, []);
    useEffect(() => {
        if (mode !== "export") return;
        if (documentRaw !== undefined) { setText(documentRaw); setExported({ text: documentRaw, diagnostics: [] }); setBusy(false); return; }
        let cancelled = false;
        setBusy(true); setError(""); setText(""); setExported(null);
        import("@/lib/kruczie/znamen")
            .then(api => api.exportZnamenText(layers, useSource && source ? source : undefined, shift))
            .then(result => {
                if (cancelled) return;
                setExported(result); setText(result.text ?? "");
                if (result.text === null) setError("Нельзя безопасно изменить этот блок: не совпали слои или не разобрана конструкция. Выберите «Новый фрагмент» либо сохраните исходник без изменений.");
            }).catch(error => { if (!cancelled) setError(error instanceof Error ? error.message : "Ошибка экспорта."); })
            .finally(() => { if (!cancelled) setBusy(false); });
        return () => { cancelled = true; };
    }, [mode, layers, source, useSource, documentRaw, shift]);

    async function parse() {
        setBusy(true); setError(""); setFile(null);
        try {
            const { importZnamenText } = await import("@/lib/kruczie/znamen");
            const parsed = await importZnamenText(text);
            setFile(parsed); setBlockIndex(0); setLayer(parsed.blocks[0].notation !== undefined ? "notation" : "melody");
        } catch (error) { setError(error instanceof Error ? error.message : "Ошибка импорта."); }
        finally { setBusy(false); }
    }
    async function copy() {
        try { await navigator.clipboard.writeText(text); setNotice("Исходник скопирован."); }
        catch { setNotice("Выделите текст и скопируйте его вручную."); }
    }
    return <dialog ref={dialog} onClose={event => {
        // StrictMode reopens the dialog after effect cleanup. close() queues its
        // event: ignore it if this same dialog has already been opened again.
        if (!event.currentTarget.open) onClose();
    }} aria-labelledby="znamen-dialog-title"
        className="rounded border border-slate-300 p-5 w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto backdrop:bg-black/40">
        <div className="flex items-start justify-between gap-4 mb-3">
            <h2 id="znamen-dialog-title" className="font-bold">{mode === "import" ? "Импорт из znamen.ru" : "Экспорт в znamen.ru"}</h2>
            <button type="button" className={control} onClick={onClose}>Закрыть</button>
        </div>
        {mode === "import" ? <p className="text-sm text-slate-600 mb-3">Вставьте текстовый исходник с директивами %з, %н и %т. После разбора выберите музыкальный блок и слой для проверки. Остальные части исходника сохранятся для экспорта.</p>
            : <div className="mb-3 flex flex-col gap-2">
                {documentRaw !== undefined ? <p className="font-bold">Экспортируется произведение целиком</p> : <label className="flex items-center gap-2">Что экспортировать
                    <select disabled={documentRaw !== undefined} className={control} value={useSource ? "source" : "fragment"} onChange={e => { setUseSource(e.target.value === "source"); setNotice(""); }}>
                        {source && <option value="source">Исходный документ с выбранным блоком</option>}
                        <option value="fragment">Новый фрагмент</option>
                    </select>
                </label>}
                <p className="text-sm text-slate-600">В исходном документе заменяется выбранный вариант. Если настроена высота, все музыкальные блоки документа переносятся согласованно. Заголовки, певческий текст и дополнительные пометы сохраняются. Новый фрагмент содержит только музыкальные слои.</p>
            </div>}
        <label htmlFor="znamen-source" className="block mb-1">Текстовый исходник znamen.ru</label>
        <textarea id="znamen-source" autoFocus spellCheck={false} readOnly={mode === "export"} disabled={busy && mode === "import"} rows={12} maxLength={200000}
            className={`${control} font-mono text-sm w-full`} value={text} onChange={e => { setText(e.target.value); setFile(null); setError(""); }} />
        {mode === "import" && (looksLikeEscapedZnamen(text) || originalPaste !== null) && <div className="my-2 text-sm text-amber-800">
            <p>Похоже, при копировании добавлено Markdown-экранирование. Это отличается от настоящих палок в крюковой записи.</p>
            <button type="button" className={`${control} mt-2`} disabled={busy} onClick={() => {
                if (originalPaste !== null) { setText(originalPaste); setOriginalPaste(null); }
                else { setOriginalPaste(text); setText(unescapeZnamenPaste(text)); }
                setFile(null); setError("");
            }}>{originalPaste !== null ? "Вернуть исходную вставку" : "Снять Markdown-экранирование"}</button>
        </div>}
        {busy && <p role="status">{mode === "import" ? "Разбираем исходник…" : "Готовим исходник…"}</p>}
        {error && <p role="alert" className="text-red-800 mt-2">{error}</p>}
        {mode === "import" && <button type="button" disabled={busy || !text.trim()} className={`${control} my-3`} onClick={parse}>Разобрать текст</button>}
        {mode === "import" && file && <div className="flex flex-col gap-3 mt-2">
            {onImportWork && <button type="button" className="rounded bg-red-900 text-white px-4 py-2" onClick={() => onImportWork(file.raw)}>Использовать произведение целиком ({file.blocks.length} блоков)</button>}
            <label>Музыкальный блок
                <select className={`${control} block w-full`} value={blockIndex} onChange={e => {
                    const index = Number(e.target.value); setBlockIndex(index); setLayer(file.blocks[index].notation !== undefined ? "notation" : "melody");
                }}>
                    {file.blocks.map((b, i) => <option key={i} value={i}>Блок {i + 1} · {b.notation !== undefined ? "крюки" : ""}{b.notation !== undefined && b.melody !== undefined ? " + " : ""}{b.melody !== undefined ? "ноты" : ""}{b.text ? ` · ${b.text.slice(0, 60)}` : ""}</option>)}
                </select>
            </label>
            <label>Слой для перевода
                <select className={`${control} block`} value={layer} onChange={e => setLayer(e.target.value as "notation" | "melody")}>
                    {block?.notation !== undefined && <option value="notation">Крюки → ноты</option>}
                    {block?.melody !== undefined && <option value="melody">Ноты → крюки</option>}
                </select>
            </label>
            <pre className="whitespace-pre-wrap break-all text-sm">{block?.[layer]}</pre>
            <button type="button" className="rounded bg-red-900 text-white px-4 py-2 disabled:opacity-50" disabled={!block?.[layer]?.trim() || (block?.[layer]?.length ?? 0) > 1000}
                onClick={() => { if (block?.[layer]) onImport({ raw: file.raw, blockIndex }, layer, block[layer]!); }}>Использовать выбранную строку</button>
            {(block?.[layer]?.length ?? 0) > 1000 && <p className="text-amber-800">Для опыта выберите строку не длиннее 1000 знаков.</p>}
        </div>}
        {mode === "export" && <button type="button" className={`${control} mt-3`} disabled={busy || !text} onClick={copy}>Скопировать исходник</button>}
        {notice && <p role="status" className="mt-2">{notice}</p>}
        {((file?.diagnostics.length ?? 0) > 0 || (exported?.diagnostics.length ?? 0) > 0) && <details className="mt-3 text-sm" open={(file?.diagnostics ?? exported?.diagnostics ?? []).some(d => d.severity === "error")}>
            <summary>Диагностика формата: ошибок {(file?.diagnostics ?? exported?.diagnostics ?? []).filter(d => d.severity === "error").length}, замечаний {(file?.diagnostics ?? exported?.diagnostics ?? []).filter(d => d.severity === "warning").length}</summary>
            <ul className="list-disc pl-5">{(file?.diagnostics ?? exported?.diagnostics ?? []).map((d, i) => <li key={i} className={d.severity === "error" ? "text-red-800" : "text-amber-800"}>{diagnosticText(d)} <code title={d.message}>{d.code}</code></li>)}</ul>
        </details>}
    </dialog>;
}
