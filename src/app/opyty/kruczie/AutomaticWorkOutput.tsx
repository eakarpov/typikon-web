'use client';
import { useEffect, useState } from "react";
import type { WorkResult, WorkView } from "@/lib/kruczie/work";
import { assembleAutomaticWork, type AutomaticWork } from "@/lib/kruczie/automaticWork";
import type { Direction } from "@/lib/kruczie/model";
import type { NotationShift } from "@/lib/kruczie/transposition";
import type { NoteStyle } from "@/lib/kruczie/notation";
import TransposedScore from "./TransposedScore";
import CorpusPreference, { FallbackNotice } from "./CorpusPreference";

const button = "border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 disabled:opacity-50";
export default function AutomaticWorkOutput({ view, results, direction, shift, style, active, activeNote, onPlay, onExport }: {
    view: WorkView; results: Readonly<Record<number, WorkResult>>; direction: Direction; shift: NotationShift; style: NoteStyle;
    active: boolean; activeNote: number | null; onPlay: (notes: string) => void; onExport: (raw: string) => void;
}) {
    const [output, setOutput] = useState<AutomaticWork | null>(null);
    const [error, setError] = useState("");
    const [exportState, setExportState] = useState<{ key: string; raw?: string; error?: string } | null>(null);
    useEffect(() => {
        let cancelled = false;
        setOutput(null); setError("");
        assembleAutomaticWork(view, results, direction).then(value => { if (!cancelled) setOutput(value); })
            .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Не удалось собрать автоматический разбор."); });
        return () => { cancelled = true; };
    }, [view, results, direction]);
    const { semitones, tradition, tone } = shift;
    const key = JSON.stringify([output?.raw, semitones, tradition, tone]);
    useEffect(() => {
        if (!output?.raw || !semitones) return;
        let cancelled = false;
        import("@/lib/kruczie/transposition").then(api => api.transposeZnamen(output.raw!, { semitones, tradition, tone }))
            .then(raw => { if (!cancelled) setExportState({ key, raw }); })
            .catch(cause => { if (!cancelled) setExportState({ key, error: cause.message }); });
        return () => { cancelled = true; };
    }, [output?.raw, key, semitones, tradition, tone]);
    const exported = !shift.semitones ? output?.raw : exportState?.key === key ? exportState.raw : undefined;
    const exportError = shift.semitones && exportState?.key === key ? exportState.error : undefined;
    let offset = 0;
    return <section className="border-2 border-green-700 rounded p-3 min-w-0" aria-label="Автоматический двоезнаменник">
        <h3 className="font-bold">Автоматический двоезнаменник всего произведения</h3>
        <p className="text-sm">Совместный выбор последовательности для всего произведения с учётом гласа, источника и соседних колен. При равном рейтинге берётся первый вариант в стабильном порядке. Ручные выборы ниже не меняют этот результат.</p>
        {error && <p role="alert" className="text-red-800">{error}</p>}
        {!output && !error && <p role="status">Собираем автоматический разбор…</p>}
        {output && <>
            <p role="status">Автоматически покрыто позиций: {output.covered} из {output.total}. {output.gaps.length ? `Неразрешённых участков: ${output.gaps.length}. Пропуски не заменяются паузами; полный музыкальный экспорт и проигрывание недоступны.` : "Готов единый двоезнаменник без ручного выбора."}</p>
            {output.blocks.find(b => b.ranking?.preference?.scope === "work") && <CorpusPreference ranking={output.blocks.find(b => b.ranking?.preference?.scope === "work")!.ranking} />}
            {output.blocks.some(b => b.ranking?.fallbacks?.length) && <p className="text-sm text-amber-900">Есть дополнительные предложения по помеченным вариантам или вне выбранного гласа. Основания указаны у соответствующих слогов.</p>}
            <div className="flex flex-wrap gap-2 my-2">
                <button className={button} disabled={!output.notes} onClick={() => onPlay(output.notes)}>{active ? "Остановить автоматический разбор" : "Послушать автоматический разбор"}</button>
                <button className={button} disabled={!exported} onClick={() => exported && onExport(exported)}>Экспорт автоматического двоезнаменника</button>
            </div>
            {exportError && <p role="alert" className="text-amber-800">{exportError} Экспорт в выбранной высоте заблокирован.</p>}
            {output.raw && shift.semitones !== 0 && !exported && !exportError && <p role="status">Проверяем перенос автоматического результата…</p>}
            {view.header && <pre className="text-xs whitespace-pre-wrap">{view.header}</pre>}
            <div className="flex flex-wrap gap-x-1 gap-y-3 py-2" aria-label="Единая автоматическая запись со слогами">
                {output.blocks.flatMap((block, blockIndex) => block.cells.length ? block.cells.map((cell, position) => {
                    const count = cell.syllable.melody?.events?.filter(e => e.kind === "note" || e.kind === "reciting").length ?? 0;
                    const highlighted = active && activeNote !== null && activeNote >= offset && activeNote < offset + count ? activeNote - offset : null;
                    offset += count;
                    const fallback = block.ranking?.fallbacks?.find(f => f.position === position);
                    const parallel = block.ranking?.parallels?.find(p => p.position === position);
                    const gap = output.gaps.find(g => g.block === blockIndex && g.position === position);
                    return <div className="min-w-[130px] border-r border-slate-200 px-1" key={`${blockIndex}:${position}`}>
                        <span className="text-xs text-slate-400">{blockIndex + 1}:{position + 1}</span>
                        <TransposedScore notation={cell.syllable.notation?.raw} unicode={cell.unicode} melody={cell.syllable.melody} shift={shift} style={style} activeNote={highlighted} compact />
                        {fallback && <FallbackNotice fallback={fallback} />}
                        {parallel && <a className="block text-xs text-green-900 underline" href={parallel.url} target="_blank" rel="noreferrer">Из параллели {parallel.sourceId}, блок {parallel.sourceBlock+1}, позиция {parallel.sourcePosition+1}{parallel.match === "text-family" ? " · беспометный вариант по тексту и знаку" : " · точное крюковое соответствие"}</a>}
                        {gap && <p className="text-xs text-amber-800 border border-dashed border-amber-600 p-2">Пропуск · {gap.reason}</p>}
                        <p className="font-bold text-center">{cell.textUnicode || "∅"}{cell.syllable.text.separator === "-" ? "-" : ""}</p>
                    </div>;
                }) : [<pre className="text-sm text-amber-800 whitespace-pre-wrap" key={`unaligned:${blockIndex}`}>Блок {blockIndex + 1}: привязка не определена; исходный блок сохранён.{"\n"}{view.file.raw.slice(view.file.blocks[blockIndex].range.start, view.file.blocks[blockIndex].range.end)}</pre>])}
            </div>
            {view.footer && <pre className="text-xs whitespace-pre-wrap">{view.footer}</pre>}
            <details><summary>Основания автоматического выбора</summary>{output.blocks.map((block, index) => <div key={index} className="my-2 text-sm">
                <p>Блок {index + 1}{block.tied > 1 ? ` · равнозначных вариантов: ${block.tied}, выбран первый` : ""}{block.truncated ? " · поиск ограничен" : ""}</p>
                {(block.ranking?.score || block.ranking?.fallbacks?.length) ? <CorpusPreference ranking={block.ranking} /> : <p>Частотных оснований нет: сохранён исходный слой или выбран первый известный вариант каталога.</p>}
            </div>)}</details>
            {exported && <label className="block mt-3 text-sm">Единый текст znamen.ru
                <textarea className="block w-full h-56 border border-slate-300 rounded p-2 font-mono text-xs" aria-label="Автоматический двоезнаменник в формате znamen.ru" readOnly value={exported} />
            </label>}
        </>}
    </section>;
}
