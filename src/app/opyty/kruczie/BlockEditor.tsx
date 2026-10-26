'use client';
import { useState } from "react";
import type { WorkView, CellDraft } from "@/lib/kruczie/work";

const field = "border border-slate-300 rounded px-2 py-1 bg-white text-slate-900";
export default function BlockEditor({ view, index, onSave, onClose }: { view: WorkView; index: number; onSave: (raw: string) => void; onClose: () => void }) {
    const block = view.file.blocks[index], row = view.blocks[index];
    const [cells, setCells] = useState<CellDraft[]>(row.cells.map(({ syllable }) => ({ notation: syllable.notation?.raw ?? "", melody: syllable.melody?.raw ?? "", text: syllable.text.raw, separator: syllable.text.separator ?? " " })));
    const rawMode = !block.aligned;
    const [notation, setNotation] = useState(block.notation !== undefined);
    const [melody, setMelody] = useState(block.melody !== undefined);
    const [layers, setLayers] = useState({ notation: block.notation ?? "", melody: block.melody ?? "", text: block.text ?? "" });
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    function change(position: number, key: keyof CellDraft, value: string) { setCells(old => old.map((cell, i) => i === position ? { ...cell, [key]: value } : cell)); }
    async function save() {
        setError(""); setBusy(true);
        try {
            const api = await import("@/lib/kruczie/work");
            const raw = rawMode ? await api.saveBlockLayers(view.file.raw, index, { text: layers.text, ...(notation ? { notation: layers.notation } : {}), ...(melody ? { melody: layers.melody } : {}) })
                : await api.saveBlockCells(view.file.raw, index, cells, notation, melody);
            onSave(raw);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось сохранить привязку."); }
        finally { setBusy(false); }
    }
    return <section aria-label={`Привязка слогов блока ${index + 1}`} className="border border-amber-300 rounded p-3 mt-3">
        <h3 className="font-bold">Привязка слогов · блок {index + 1}</h3>
        <p className="text-sm text-slate-600 my-2">Одна позиция связывает слог с одним или несколькими крюками и нотами. Несколько крюков в позиции: через ~~; ноты — слитно; слова на одной позиции — через +. Пустой слог обозначается _.</p>
        <fieldset disabled={busy} className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-4">
                <label><input type="checkbox" checked={notation} disabled={block.notation !== undefined} onChange={e => setNotation(e.target.checked)} /> Слой крюков</label>
                <label><input type="checkbox" checked={melody} disabled={block.melody !== undefined} onChange={e => setMelody(e.target.checked)} /> Слой нот</label>
            </div>
            {rawMode ? <>
                {(["notation", "melody", "text"] as const).map(key => (key === "notation" && !notation) || (key === "melody" && !melody) ? null : <label key={key} className="flex flex-col gap-1">
                    {key === "notation" ? "Крюки (%з)" : key === "melody" ? "Ноты (%н)" : "Текст (%т)"}
                    <textarea rows={2} className={`${field} font-mono text-sm w-full`} value={layers[key]} spellCheck={false} onChange={e => setLayers(old => ({ ...old, [key]: e.target.value }))} />
                </label>)}
                <p className="text-sm text-amber-800">Сохранение разрешено, когда число музыкальных групп и текстовых позиций совпадёт. Текст делится дефисами и пробелами; варианты в скобках и слова через + остаются в своей позиции.</p>
            </> : <div className="overflow-x-auto">
                <table className="text-sm border-collapse">
                    <thead><tr>{["Позиция", ...(notation ? ["Крюки"] : []), ...(melody ? ["Ноты"] : []), "Слог", "После слога", ""].map((name, i) => <th className="text-left p-1" key={i}>{name}</th>)}</tr></thead>
                    <tbody>{cells.map((cell, i) => <tr key={i}>
                        <td className="p-1">{i + 1}</td>
                        {notation && <td className="p-1"><input aria-label={`Крюки позиции ${i + 1}`} className={`${field} font-mono w-36`} value={cell.notation} onChange={e => change(i, "notation", e.target.value)} /></td>}
                        {melody && <td className="p-1"><input aria-label={`Ноты позиции ${i + 1}`} className={`${field} font-mono w-36`} value={cell.melody} onChange={e => change(i, "melody", e.target.value)} /></td>}
                        <td className="p-1"><input aria-label={`Слог позиции ${i + 1}`} className={`${field} w-32`} value={cell.text} onChange={e => change(i, "text", e.target.value)} /></td>
                        <td className="p-1"><select aria-label={`Разделитель позиции ${i + 1}`} className={field} value={cell.separator} onChange={e => change(i, "separator", e.target.value)}><option value="-">Дефис</option><option value=" ">Пробел</option><option value="">Конец</option></select></td>
                        <td className="p-1"><button className={field} type="button" disabled={cells.length === 1} onClick={() => setCells(old => old.filter((_, position) => position !== i))}>Удалить позицию {i + 1}</button></td>
                    </tr>)}</tbody>
                </table>
                <button type="button" className={`${field} mt-2`} onClick={() => setCells(old => [...old.map((cell, i) => i === old.length - 1 && !cell.separator ? { ...cell, separator: "-" } : cell), { notation: "", melody: "", text: "", separator: "" }])}>Добавить позицию</button>
            </div>}
            {error && <p role="alert" className="text-red-800 whitespace-pre-wrap">{error}</p>}
            <div className="flex flex-wrap gap-2">
                <button type="button" className="bg-red-900 text-white rounded px-3 py-2" onClick={save}>{busy ? "Сохраняем…" : "Сохранить привязку"}</button>
                <button type="button" className={field} onClick={onClose}>Отмена</button>
            </div>
        </fieldset>
    </section>;
}
