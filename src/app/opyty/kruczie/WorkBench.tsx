'use client';
import { useEffect, useRef, useState } from "react";
import type { ChantTradition, Tone } from "@znamenica/kruczie";
import { type WorkView, type WorkResult, type WorkCandidate, type WorkCell } from "@/lib/kruczie/work";
import type { Direction } from "@/lib/kruczie/model";
import type { NoteStyle } from "@/lib/kruczie/notation";
import TransposedScore from "./TransposedScore";
import type { NotationShift } from "@/lib/kruczie/transposition";
import { useMelodyPlayback } from "./useMelodyPlayback";
import ZnamenDialog from "./ZnamenDialog";
import BlockEditor from "./BlockEditor";
import CorpusControls from "./CorpusControls";
import CorpusPreference from "./CorpusPreference";
import CellNoteEditor from "./CellNoteEditor";
import { createNoteFill, resolvedWorkCells, exportCompletedWork, encodeWorkDraft, WORK_DRAFT_KEY, type WorkFills, type SavedWorkDraft } from "@/lib/kruczie/workDraft";

import { diagnosticText } from "@/lib/kruczie/diagnostics";

import PitchReference from "./PitchReference";
import { DEFAULT_PITCH_REFERENCE, referenceShift, type PitchReferenceSettings } from "@/lib/kruczie/reference";

const field = "border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 disabled:opacity-50";
function ScoreCells({ cells, style, activeNote, shift, onChoose, onManual, onClear, disabled }: { onManual: (position: number, raw: string) => Promise<void>; onClear: (position: number) => void; disabled: boolean; onChoose: (position: number, choice: number) => void; shift: NotationShift; cells: readonly WorkCell[]; style: NoteStyle; activeNote: number | null }) {
    const hasNotes = cells.some(cell => cell.syllable.melody || cell.melodyOptions?.length || cell.partial);
    let offset = 0;
    return <div className="flex overflow-x-auto gap-2 py-2" aria-label="Слоговая привязка">
        {cells.map((cell, i) => {
            const count = cell.syllable.melody?.events?.filter(e => e.kind === "note" || e.kind === "reciting").length ?? 0;
            const highlighted = activeNote !== null && activeNote >= offset && activeNote < offset + count ? activeNote - offset : null;
            offset += count;
            return <div key={i} className="shrink-0 min-w-[130px] border-r border-slate-200 px-2">
                <p className="text-xs text-slate-400">Позиция {i + 1}</p>
                <TransposedScore notation={cell.syllable.notation?.raw} unicode={cell.unicode} melody={cell.syllable.melody} shift={shift} style={style} activeNote={highlighted} compact />
                {cell.fillOrigin && <p className={`text-xs ${cell.fillOrigin === "manual" ? "text-amber-800" : "text-green-800"}`}>{cell.fillOrigin === "manual" ? "Ручной ввод · не подтверждён базой" : "Выбранный развод сохранён"}</p>}
                {cell.partial && cell.syllable.melody && <p className="text-xs text-amber-800">Частичный разбор</p>}
                <MelodyAlternatives cell={cell} position={i} shift={shift} style={style} disabled={disabled} onChoose={choice => onChoose(i,choice)} />
                {hasNotes && !cell.syllable.melody && !cell.melodyOptions?.length && <div className="h-[135px] min-w-[130px] border border-dashed border-amber-500 rounded flex items-center justify-center text-center text-xs text-amber-900 p-2" role="img" aria-label={`Ноты не найдены, позиция ${i + 1}`}>Нет подтверждённого развода<br />Пропуск, не пауза</div>}
                <CellNoteEditor position={i} raw={cell.syllable.melody?.raw ?? ""} disabled={disabled} onSave={value => onManual(i, value)} onClear={() => onClear(i)} />
                <p className="font-bold text-center mt-2 whitespace-pre-wrap">{cell.textUnicode || "∅"}{cell.syllable.text.separator === "-" ? "-" : ""}</p>
            </div>;
        })}
    </div>;
}
function MelodyAlternatives({ cell, position, shift, style, disabled, onChoose }: { cell: WorkCell; position: number; shift: NotationShift; style: NoteStyle; disabled: boolean; onChoose: (choice: number) => void }) {
    const [expanded,setExpanded] = useState(false);
    const options = cell.melodyOptions ?? [];
    if (cell.syllable.melody) {
        const selected=options.findIndex(m=>m.raw.replace(/\s+/gu, "")===cell.syllable.melody!.raw.replace(/\s+/gu, ""));
        return <>{selected>=0 && <CorpusPreference ranking={cell.melodyRankings?.[selected]} hypothesis />}{options.length>1 && <button className="text-xs underline" disabled={disabled} onClick={()=>onChoose(-1)}>Показать все варианты</button>}</>;
    }
    if (options.length<2) return null;
    return <div className="text-xs flex flex-col gap-2 max-w-[240px]">
        <p className="text-amber-800">Неоднозначный развод · вариантов {options.length}</p>
        {options.slice(0,expanded?options.length:3).map((melody,choice)=><div className="border border-dashed border-slate-300 rounded p-1" key={choice}>
            <p>Вариант {choice+1}</p>
            <TransposedScore unicode="" melody={melody} shift={shift} style={style} activeNote={null} compact />
            <CorpusPreference ranking={cell.melodyRankings?.[choice]} hypothesis />
            <button className="underline" disabled={disabled} onClick={()=>onChoose(choice)}>Выбрать вариант {choice+1} позиции {position+1}</button>
        </div>)}
        {options.length>3 && <button className="underline" onClick={()=>setExpanded(!expanded)}>{expanded?"Свернуть варианты":`Показать остальные варианты (${options.length-3})`}</button>}
    </div>;
}
export default function WorkBench({ initialRaw, initialDraft, onBack }: { initialRaw: string; initialDraft?: SavedWorkDraft | null; onBack: () => void }) {
    const [raw, setRaw] = useState(initialRaw);
    const [fills, setFills] = useState<WorkFills>(initialDraft?.fills ?? {});
    const [saveStatus, setSaveStatus] = useState("");
    const [view, setView] = useState<WorkView | null>(null);
    const [results, setResults] = useState<Record<number, WorkResult>>({});
    const [partialChoices, setPartialChoices] = useState<Record<number, Record<number, number>>>({});
    const [selected, setSelected] = useState<Record<number, WorkCandidate>>({});
    const [direction, setDirection] = useState<Direction>("to-notes");
    const [tradition, setTradition] = useState<ChantTradition>("znamenny");
    const [tone, setTone] = useState("");
    const [corpusSource, setCorpusSource] = useState("");
    const [style, setStyle] = useState<NoteStyle>("round");
    const [bpm, setBpm] = useState(96);
    const [pitchReference, setPitchReference] = useState<PitchReferenceSettings>({ ...DEFAULT_PITCH_REFERENCE });
    const shift = { semitones: referenceShift(pitchReference, tradition, tone ? Number(tone) as Tone : undefined), tradition, tone: tone ? Number(tone) as Tone : undefined };
    const playback = useMelodyPlayback(bpm, shift.semitones);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState("");
    const [editing, setEditing] = useState<number | null>(null);
    const [exportedRaw, setExportedRaw] = useState<string | null>(null);
    const initialized = useRef(false);
    const worker = useRef<Worker | null>(null);
    const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
    function cancel() {
        worker.current?.terminate(); worker.current = null;
        if (watchdog.current) clearTimeout(watchdog.current);
        watchdog.current = null; setBusy(false);
    }
    function reset() { cancel(); playback.stop(); setResults({}); setSelected({}); setPartialChoices({}); setError(""); setProgress(0); }
    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError("");
        import("@/lib/kruczie/work").then(api => api.inspectWork(raw)).then(value => { if (!cancelled) {
                setView(value);
                if (!initialized.current) { initialized.current = true; if (value.headerTone) setTone(String(value.headerTone)); if (value.file.blocks.every(block => block.notation === undefined)) setDirection("to-neumes"); }
            } })
            .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Не удалось прочитать произведение."); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [raw]);
    useEffect(() => {
        let cancelled = false;
        const persisted: WorkFills = Object.fromEntries(Object.entries(fills).map(([block, values]) => [block, { ...values }]));
        // Include the unique known previews, so a reload retains every visible note.
        (view?.file.raw === raw ? view.blocks : []).forEach((row, index) => {
            if (selected[index]) return;
            resolvedWorkCells(row, results[index], partialChoices[index] ?? {}, fills[index]).forEach((cell, position) => {
                if (cell.partial && cell.syllable.melody) {
                    persisted[index] ??= {};
                    persisted[index][position] = { raw: cell.syllable.melody.raw, melody: cell.syllable.melody, origin: "catalog" };
                }
            });
        });
        try {
            localStorage.setItem(WORK_DRAFT_KEY, encodeWorkDraft({ version: 1, raw, fills: persisted }));
            setSaveStatus("Разбор сохранён в этом браузере. Его можно восстановить после перезагрузки.");
        } catch { setSaveStatus("Не удалось сохранить разбор в браузере. Текущие правки остаются открыты; экспортируйте заполненный документ."); }
        if (Object.keys(selected).length) void import("@/lib/kruczie/work").then(api => api.exportWork(raw, selected)).then(source => {
            if (!cancelled) localStorage.setItem(WORK_DRAFT_KEY, encodeWorkDraft({ version: 1, raw: source, fills: persisted }));
        }).catch(() => { if (!cancelled) setSaveStatus("Не удалось сохранить выбранные блоки в браузере."); });
        return () => { cancelled = true; };
    }, [raw, selected, fills, view, results, partialChoices]);
    useEffect(() => () => { worker.current?.terminate(); if (watchdog.current) clearTimeout(watchdog.current); }, []);
    function convert() {
        reset(); setBusy(true);
        try {
            const active = new Worker(new URL("./work.worker.ts", import.meta.url));
            worker.current = active;
            const arm = () => {
                if (watchdog.current) clearTimeout(watchdog.current);
                watchdog.current = setTimeout(() => { cancel(); setError("Обработка блока заняла слишком много времени. Уже найденные результаты сохранены."); }, 30000);
            };
            active.onmessage = (event: MessageEvent<{ result?: WorkResult; completed?: number; done?: boolean; error?: string }>) => {
                if (worker.current !== active) return;
                if (event.data.result) { const result = event.data.result; setResults(old => ({ ...old, [result.blockIndex]: result })); setProgress(event.data.completed ?? 0); arm(); }
                if (event.data.error) { setError(event.data.error); cancel(); }
                if (event.data.done) cancel();
            };
            active.onerror = event => { event.preventDefault(); cancel(); setError("Не удалось загрузить обработчик произведения. Повторите попытку."); };
            arm(); active.postMessage({ raw, options: { direction, tradition, corpusSourceId: corpusSource || undefined, ...(tone ? { tone: Number(tone) as Tone } : {}) } });
        } catch { cancel(); setError("Не удалось начать обработку произведения."); }
    }
    async function exportFile() {
        playback.stop(); setError("");
        try { const { transposeZnamen } = await import("@/lib/kruczie/transposition"); setExportedRaw(await transposeZnamen(await exportCompletedWork(view!, view!.blocks.map((_, index) => cellsOf(index))), shift)); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось экспортировать произведение."); }
    }
    const cellsOf = (index: number) => view?.blocks[index] ? resolvedWorkCells({ ...view.blocks[index], cells: selected[index]?.cells ?? view.blocks[index].cells }, selected[index] ? undefined : results[index], partialChoices[index] ?? {}, fills[index]) : [];
    const wholeNotes = view?.blocks.every((_, i) => cellsOf(i).length > 0 && cellsOf(i).every(cell => cell.syllable.melody))
        ? view.blocks.flatMap((_, i) => cellsOf(i).map(cell => cell.syllable.melody!.raw)).join(" ") : "";
    const allCells = view?.blocks.flatMap((_, index) => cellsOf(index)) ?? [];
    const filledCount = allCells.filter(cell => cell.syllable.melody).length;
    async function saveManual(block: number, position: number, value: string) {
        const fill = await createNoteFill(value, "manual");
        playback.stop(); setFills(old => ({ ...old, [block]: { ...old[block], [position]: fill } }));
    }
    function clearFill(block: number, position: number) {
        playback.stop(); setFills(old => { const next = { ...old, [block]: { ...old[block] } }; delete next[block][position]; return next; });
        setPartialChoices(old => ({ ...old, [block]: { ...old[block], [position]: -1 } }));
    }
    function chooseFill(block: number, position: number, choice: number) {
        if (choice < 0) { clearFill(block, position); return; }
        const melody = results[block]?.positions?.find(p => p.index === position)?.melodies[choice];
        if (!melody) return;
        playback.stop(); void createNoteFill(melody.raw, "catalog").then(fill => setFills(old => ({ ...old, [block]: { ...old[block], [position]: fill } }))).catch(cause => setError(cause.message));
    }
    let workNoteOffset = 0;
    return <div className="flex flex-col gap-4">
        <h2 className="font-bold">Произведение целиком</h2>
        <p className="text-sm text-slate-600">Блоки и слоговые позиции сохраняются раздельно. Выберите вариант для каждого блока; в экспорт попадут только выбранные варианты и явно сохранённые правки.</p>
        <div className="flex flex-wrap gap-2">
            <button className={field} onClick={() => { cancel(); playback.stop(); onBack(); }}>Вернуться к отдельной строке</button>
            <button className={field} disabled={loading || busy || !wholeNotes || editing !== null} onClick={exportFile}>Экспорт произведения в znamen.ru</button>
        </div>
        {exportedRaw !== null && <ZnamenDialog mode="export" source={null} layers={{}} documentRaw={exportedRaw} onClose={() => setExportedRaw(null)} onImport={() => {}} />}
        <p role="status" className="text-xs text-slate-600">{saveStatus}</p>
        <p className="text-sm">Нотных позиций заполнено: {filledCount} из {allCells.length}. Ручных: {allCells.filter(cell => cell.fillOrigin === "manual").length}. Для прослушивания и экспорта заполните все пропуски и выберите неоднозначные разводы.</p>
        {loading && <p role="status">Разбираем музыкальные блоки и слоги…</p>}
        {view && !loading && <>
            {view.header && <details open><summary className="font-bold">Шапка произведения</summary><pre className="text-sm whitespace-pre-wrap mt-2">{view.header}</pre></details>}
            <p>Музыкальных блоков: {view.blocks.length}. С подтверждённой привязкой: {view.blocks.filter((_, i) => view.file.blocks[i].aligned).length}. Выбрано вариантов: {Object.keys(selected).length}.</p>
            {view.headerTone && tone === String(view.headerTone) && <p className="text-sm text-slate-600">Глас {view.headerTone} явно указан в шапке источника и выбран для поиска.</p>}
            <div className="flex flex-wrap gap-3">
                <label>Направление <select disabled={busy || editing !== null} className={field} value={direction} onChange={e => { reset(); setDirection(e.target.value as Direction); }}><option value="to-notes">Крюки → ноты</option><option value="to-neumes">Ноты → крюки</option></select></label>
                <label>Распев <select disabled={busy || editing !== null} className={field} value={tradition} onChange={e => { reset(); setTradition(e.target.value as ChantTradition); }}><option value="znamenny">Знаменный</option><option value="demestvenny">Демественный</option></select></label>
                <label>Глас <select disabled={busy || editing !== null} className={field} value={tone} onChange={e => { reset(); setTone(e.target.value); }}><option value="">Не задан</option>{[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
            </div>
            <CorpusControls value={corpusSource} disabled={busy || editing !== null} onChange={value => { reset(); setCorpusSource(value); }} />
            <div className="flex flex-wrap gap-2">
                <button className="bg-red-900 text-white rounded px-3 py-2 disabled:opacity-50" disabled={busy || editing !== null} onClick={convert}>Преобразовать всё произведение</button>
                {busy && <button className={field} onClick={cancel}>Остановить обработку</button>}
            </div>
            <p role="status">Обработано блоков: {progress} из {view.blocks.length}{busy ? "…" : ""}</p>
            <div className="flex flex-wrap gap-3">
                <label>Вид нот <select className={field} value={style} onChange={e => setStyle(e.target.value as NoteStyle)}><option value="round">Круглые</option><option value="kievan">Киевские квадратные</option></select></label>
                <label>Темп <select className={field} value={bpm} onChange={e => { playback.stop(); setBpm(Number(e.target.value)); }}><option value={66}>66</option><option value={96}>96</option><option value={132}>132</option></select></label>
                <button className={field} disabled={!wholeNotes || busy} onClick={() => { if (playback.active === -1) playback.stop(); else void playback.play(wholeNotes, -1); }}>{playback.active === -1 ? "Остановить произведение" : "Послушать произведение"}</button>
            </div>
            <PitchReference tradition={tradition} tone={tone ? Number(tone) as Tone : undefined} value={pitchReference} onChange={value => { playback.stop(); setPitchReference(value); }} />
            {playback.error && <p role="alert" className="text-red-800">{playback.error}</p>}
            {view.file.diagnostics.length > 0 && <details><summary>Диагностика исходника ({view.file.diagnostics.length})</summary><ul className="text-sm list-disc pl-5">{view.file.diagnostics.map((d, i) => <li key={i}><code>{d.code}</code>: {diagnosticText(d)}</li>)}</ul></details>}
            {view.blocks.map((row, index) => {
                const block = view.file.blocks[index], result = results[index], cells = cellsOf(index);
                const chosen = selected[index];
                const editorView: WorkView = chosen ? { ...view,
                    blocks: view.blocks.map((row, i) => i === index ? { ...row, cells: chosen.cells } : row),
                    file: { ...view.file, blocks: view.file.blocks.map((block, i) => i === index ? { ...block, notation: chosen.neumes, melody: chosen.notes } : block) },
                } : view;
                const notes = cells.length && cells.every(cell => cell.syllable.melody) ? cells.map(cell => cell.syllable.melody!.raw).join(" ") : "";
                const count = cells.reduce((n, cell) => n + (cell.syllable.melody?.events?.filter(e => e.kind === "note" || e.kind === "reciting").length ?? 0), 0);
                const activeNote = playback.active === index ? playback.noteIndex : playback.active === -1 && playback.noteIndex !== null ? playback.noteIndex - workNoteOffset : null;
                workNoteOffset += count;
                return <section key={index} className="border border-slate-200 rounded p-3 min-w-0">
                    {row.heading && <p className="text-slate-600 whitespace-pre-wrap mb-2">{row.heading}</p>}
                    <h3 className="font-bold">Блок {index + 1}</h3>
                    <p className="whitespace-pre-wrap">{block.text ?? "Текстовый слой отсутствует"}</p>
                    {!block.aligned && <p className="text-amber-800 text-sm">Привязка слоёв не определена. Исходные строки сохранены; назначьте позиции вручную.</p>}
                    <div className="flex flex-wrap gap-2 my-2">
                        <button className={field} disabled={busy} onClick={() => { playback.stop(); setEditing(editing === index ? null : index); }}>Редактировать исходную привязку</button>
                        <button className={field} disabled={!notes || busy} aria-pressed={playback.active === index} onClick={() => { if (playback.active === index) playback.stop(); else void playback.play(notes, index); }}>{playback.active === index ? "Остановить" : "Послушать"} блок {index + 1}</button>
                    </div>
                    {result?.recommendation && <div className="border border-green-200 rounded p-2 text-sm">
                        <p>{(result.recommendation.tied ?? 1)>1 ? `Один из равно поддержанных вариантов строки (${result.recommendation.tied})` : "Предпочтительный вариант строки по корпусу"}{result.recommendation.truncated ? " · поиск ограничен" : ""}. Пропуски сохраняются.</p>
                        <CorpusPreference ranking={result.recommendation.ranking} hypothesis />
                        <button className={field} disabled={busy || editing !== null} onClick={async () => {
                            try {
                                const entries = await Promise.all(result.recommendation!.notes.map(async (notes, position) => notes && !fills[index]?.[position] && !row.cells[position].syllable.melody ? [position, await createNoteFill(notes, "catalog")] as const : null));
                                playback.stop(); setFills(old => { const block={...old[index]}; for(const entry of entries) if(entry && !block[entry[0]]) block[entry[0]]=entry[1]; return {...old,[index]:block}; });
                            } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось сохранить рекомендацию"); }
                        }}>Заполнить невыбранные позиции этим вариантом</button>
                    </div>}
                    {chosen?.ranking && <CorpusPreference ranking={chosen.ranking} />}
                    {result && <>
                        <p className="text-sm">{result.status === "translated" ? `Вариантов: ${result.candidates.length}` : result.status === "unaligned" ? "Перевод пропущен: исправьте слоговую привязку." : result.status === "missing-layer" ? "Нет входного слоя для выбранного направления." : "Частичный разбор: ниже показаны известные ноты и пропуски."}{result.truncated ? " Поиск ограничен." : ""}</p>
                        {result.candidates.length > 0 && <label className="block my-2">Вариант блока {index + 1}
                            <select className={`${field} ml-2`} disabled={busy} value={selected[index] ? result.candidates.indexOf(selected[index]) : -1} onChange={e => { playback.stop(); setEditing(null); const choice = Number(e.target.value); setFills(old => { const next = { ...old }; delete next[index]; return next; }); setSelected(old => { const next = { ...old }; if (choice < 0) delete next[index]; else next[index] = result.candidates[choice]; return next; }); }}>
                                <option value={-1}>Исходная запись</option>
                                {result.candidates.map((candidate, i) => <option key={i} value={i}>Вариант {i + 1}{candidate.preferred ? " · предпочтительный по контексту" : ""}</option>)}
                            </select>
                        </label>}
                        {!!result.positions?.length && <details className="text-sm mt-2"><summary>Соответствия отдельных позиций: {result.positions.length} из {row.cells.length} (не полный перевод)</summary>
                            <p>Известные ноты показаны ниже на своих слогах. Неоднозначные варианты можно сравнить и выбрать. Пустые позиции показаны пропусками, а не паузами. Выбранные варианты и ручные ноты сохраняются в браузере. При экспорте заполненного произведения они записываются в нотный слой своих позиций.</p>
                            <ul className="list-disc pl-5">{result.positions.map(position => <li key={position.index}>Позиция {position.index + 1}, слог «{row.cells[position.index].syllable.text.raw || "∅"}»: <code>{position.notes.join(" | ")}</code></li>)}</ul>
                        </details>}
                        {result.diagnostics.length > 0 && <details className="text-sm"><summary>Диагностика блока</summary><ul className="list-disc pl-5">{result.diagnostics.map((d, i) => <li key={i}><code>{d.code}</code>: {diagnosticText(d)}</li>)}</ul></details>}
                    </>}
                    {editing === index && <BlockEditor view={editorView} index={index} onClose={() => setEditing(null)} onSave={value => { cancel(); playback.stop(); setResults({}); setPartialChoices({}); setSelected(old => { const next = { ...old }; delete next[index]; return next; }); setFills(old => { const next = { ...old }; delete next[index]; return next; }); setRaw(value); setEditing(null); }} />}
                    {cells.length ? <ScoreCells disabled={busy || editing !== null} onManual={(position, value) => saveManual(index, position, value)} onClear={position => clearFill(index, position)} onChoose={(position, choice) => chooseFill(index, position, choice)} shift={shift} cells={cells} style={style} activeNote={activeNote} /> : <pre className="text-sm font-mono whitespace-pre-wrap mt-2">{block.notation === undefined ? "" : `%з ${block.notation}\n`}{block.melody === undefined ? "" : `%н ${block.melody}\n`}{block.text === undefined ? "" : `%т ${block.text}`}</pre>}
                    {selected[index] && <details className="text-sm"><summary>Основания выбранного варианта</summary><ul className="list-disc pl-5">{selected[index].origins.slice(0, 30).map((origin, i) => <li key={i}>{origin}</li>)}</ul></details>}
                </section>;
            })}
        </>}
        {view && !loading && view.footer && <details><summary className="font-bold">Подвал и дополнительные пометы · в переводе не участвуют</summary><pre className="text-sm whitespace-pre-wrap mt-2">{view.footer}</pre></details>}
        {error && <p role="alert" className="text-red-800 whitespace-pre-wrap">{error}</p>}
    </div>;
}
