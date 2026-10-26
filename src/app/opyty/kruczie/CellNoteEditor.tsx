'use client';
import { useState } from "react";
export default function CellNoteEditor({ position, raw, onSave, onClear, disabled }: { position: number; raw: string; onSave: (raw: string) => Promise<void>; onClear: () => void; disabled: boolean }) {
    const [open, setOpen] = useState(false), [value, setValue] = useState(raw), [error, setError] = useState(""), [busy, setBusy] = useState(false);
    return <div className="text-xs mt-2 max-w-[210px]">
        <button disabled={disabled || busy} className="underline" onClick={() => { setValue(raw); setError(""); setOpen(!open); }}>{raw ? "Изменить ноты" : "Заполнить пропуск"} · {position + 1}</button>
        {open && <div className="flex flex-col gap-2 mt-2">
            <label>Ноты позиции {position + 1}<input aria-label={`Ввести ноты позиции ${position + 1}`} value={value} maxLength={1000} spellCheck={false} className="border border-slate-300 rounded p-1 font-mono w-full" onChange={e => setValue(e.target.value)} /></label>
            <p>Система высот исходника. Например: с1м1. Пробелы между нотами одной позиции допустимы.</p>
            {error && <p role="alert" className="text-red-800">{error}</p>}
            <button disabled={busy || disabled} className="border rounded p-1" onClick={async () => { setBusy(true); setError(""); try { await onSave(value); setOpen(false); } catch (cause) { setError(cause instanceof Error ? cause.message : "Ошибка нот"); } finally { setBusy(false); } }}>Сохранить ноты позиции {position + 1}</button>
            {raw && <button disabled={busy || disabled} className="underline" onClick={() => { onClear(); setOpen(false); }}>Убрать сохранённые ноты позиции {position + 1}</button>}
            <button disabled={busy} className="underline" onClick={() => setOpen(false)}>Отмена</button>
        </div>}
    </div>;
}
