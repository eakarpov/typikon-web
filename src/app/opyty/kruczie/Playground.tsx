'use client';
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChantTradition, Tone } from "@znamenica/kruczie";
import { EXAMPLES, MAX_INPUT_LENGTH, type ConversionView, type Direction } from "@/lib/kruczie/model";

import TransposedScore from "./TransposedScore";
import type { NoteStyle } from "@/lib/kruczie/notation";

import ZnamenDialog from "./ZnamenDialog";
import type { ImportedZnamen, MusicLayers } from "@/lib/kruczie/znamen";

import { useMelodyPlayback } from "./useMelodyPlayback";

import WorkBench from "./WorkBench";
import CorpusControls from "./CorpusControls";
import CorpusPreference from "./CorpusPreference";
import { readWorkDraft, type SavedWorkDraft } from "@/lib/kruczie/workDraft";

import PitchReference from "./PitchReference";
import { DEFAULT_PITCH_REFERENCE, referenceShift, type PitchReferenceSettings } from "@/lib/kruczie/reference";

const DIAGNOSTICS: Record<string, string> = {
    SEARCH_LIMIT: "Достигнут предел поиска. Список вариантов может быть неполным.",
    UNCOVERED_INPUT: "Не удалось перевести всю запись. Непокрытый участок указан ниже.",
    UNPARSED_INPUT: "Не удалось прочитать музыкальную запись.",
    UNKNOWN_NOTE: "Есть неизвестное нотное обозначение.",
    UNKNOWN_NEUME: "Есть неизвестное крюковое обозначение.",
    UNMEASURED_DURATION: "Для речитации не задана измеренная длительность.",
    UNMAPPED_NEUME_CUE: "Подобен в скобках сохранён; его отображение пока не задано.",
    UNMAPPED_NEUME: "Обозначение распознано и сохранено; его отображение пока не задано.",
    UNMAPPED_PRIZNAK: "Обозначение прочитано, но его отображение в Unicode пока не подтверждено.",
};
const fieldClass = "border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 disabled:opacity-60";
const buttonClass = "border border-slate-300 rounded px-3 py-2 hover:bg-slate-100 disabled:opacity-50";

export default function Playground() {
    const [savedDraft, setSavedDraft] = useState<SavedWorkDraft | null>(null);
    const [restoredDraft, setRestoredDraft] = useState<SavedWorkDraft | null>(null);
    const [draftError, setDraftError] = useState("");
    useEffect(() => { let cancelled = false; readWorkDraft().then(value => { if (!cancelled) setSavedDraft(value); }).catch(() => { if (!cancelled) setDraftError("Не удалось восстановить сохранённый разбор."); }); return () => { cancelled = true; }; }, []);
    const [workRaw, setWorkRaw] = useState<string | null>(null);
    const [bpm, setBpm] = useState(96);
    const [direction, setDirection] = useState<Direction>("to-notes");
    const [tradition, setTradition] = useState<ChantTradition>("znamenny");
    const [tone, setTone] = useState("");
    const [corpusSource, setCorpusSource] = useState("");
    const [pitchReference, setPitchReference] = useState<PitchReferenceSettings>({ ...DEFAULT_PITCH_REFERENCE });
    const shift = { semitones: referenceShift(pitchReference, tradition, tone ? Number(tone) as Tone : undefined), tradition, tone: tone ? Number(tone) as Tone : undefined };
    const playback = useMelodyPlayback(bpm, shift.semitones);
    const [input, setInput] = useState(EXAMPLES.znamenny["to-notes"]);
    const [noteStyle, setNoteStyle] = useState<NoteStyle>("round");
    const [imported, setImported] = useState<ImportedZnamen | null>(null);
    const [modal, setModal] = useState<{ mode: "import" | "export"; layers: MusicLayers } | null>(null);
    const [busy, setBusy] = useState(false);
    const [view, setView] = useState<ConversionView | null>(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const worker = useRef<Worker | null>(null);
    const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestId = useRef(0);
    useEffect(() => () => {
        worker.current?.terminate();
        if (timeout.current) clearTimeout(timeout.current);
    }, []);

    function reset() { playback.stop(); setView(null); setError(""); setNotice(""); }
    function stopTimer() { if (timeout.current) clearTimeout(timeout.current); timeout.current = null; }
    function fail(message: string) {
        stopTimer(); worker.current?.terminate(); worker.current = null;
        setBusy(false); setError(message);
    }
    function submit(event: FormEvent) {
        event.preventDefault();
        if (busy) return;
        reset();
        if (!input.trim()) { setError("Введите музыкальную запись."); return; }
        setBusy(true);
        const id = ++requestId.current;
        try {
            if (!worker.current) worker.current = new Worker(new URL("./conversion.worker.ts", import.meta.url));
            worker.current.onmessage = (event: MessageEvent<{ id: number; value?: ConversionView; error?: string }>) => {
                if (event.data.id !== requestId.current) return;
                stopTimer(); setBusy(false);
                if (event.data.error) setError(event.data.error);
                else if (event.data.value) setView(event.data.value);
                else fail("Получен пустой ответ. Повторите перевод.");
            };
            worker.current.onerror = (event) => {
                event.preventDefault();
                fail("Не удалось загрузить или выполнить перевод. Проверьте соединение и повторите попытку.");
            };
            timeout.current = setTimeout(() => fail("Поиск занял слишком много времени. Попробуйте более короткую запись."), 30000);
            worker.current.postMessage({ id, request: { direction, tradition, input, corpusSourceId: corpusSource || undefined, ...(tone ? { tone: Number(tone) as Tone } : {}) } });
        } catch { fail("Не удалось запустить перевод в браузере."); }
    }
    function openModal(value: { mode: "import" | "export"; layers: MusicLayers }) {
        playback.stop(); setModal(value);
    }
    async function copy(text: string) {
        try { await navigator.clipboard.writeText(text); setNotice("Запись скопирована."); }
        catch { setNotice("Не удалось скопировать автоматически. Выделите запись и скопируйте её вручную."); }
    }

    if (workRaw !== null) return <WorkBench initialRaw={workRaw} initialDraft={restoredDraft} onBack={() => { setWorkRaw(null); void readWorkDraft().then(setSavedDraft).catch(() => {}); }} />;

    return (
        <div className="flex flex-col gap-5">
            {savedDraft && <button className={buttonClass} onClick={() => { reset(); setRestoredDraft(savedDraft); setWorkRaw(savedDraft.raw); }}>Восстановить сохранённое произведение</button>}
            {draftError && <p role="alert">{draftError}</p>}
            <div className="flex flex-wrap gap-2">
                <button type="button" className={buttonClass} disabled={busy} onClick={() => openModal({ mode: "import", layers: {} })}>Импорт из znamen.ru</button>
                <button type="button" className={buttonClass} disabled={busy || !input.trim()} onClick={() => openModal({ mode: "export", layers: direction === "to-notes" ? { notation: input.trim() } : { melody: input.trim() } })}>Экспорт в znamen.ru</button>
            </div>
            {imported && <p className="text-sm text-slate-600">Импортирован блок {imported.blockIndex + 1}. Исходный документ сохранён для экспорта.
                <button type="button" className="underline ml-2" disabled={busy} onClick={() => { setImported(null); setNotice("Связь с исходным документом снята; текущая строка сохранена."); }}>Отвязать исходник</button>
            </p>}
            {modal && <ZnamenDialog onImportWork={value => { reset(); setModal(null); setRestoredDraft(null); setWorkRaw(value); }} mode={modal.mode} shift={shift} source={imported} layers={modal.layers} onClose={() => setModal(null)}
                onImport={(source, layer, value) => { setImported(source); setInput(value); setDirection(layer === "notation" ? "to-notes" : "to-neumes"); reset(); setModal(null); }} />}
            <CorpusControls value={corpusSource} disabled={busy} onChange={value => { setCorpusSource(value); reset(); }} />
            <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={busy}>
                <fieldset disabled={busy} className="flex flex-col gap-4">
                    <legend className="sr-only">Параметры перевода</legend>
                    <div className="flex flex-wrap gap-4">
                        <label className="flex flex-col gap-1">Направление
                            <select className={fieldClass} value={direction} onChange={e => { setDirection(e.target.value as Direction); setInput(""); reset(); }}>
                                <option value="to-notes">Крюки → ноты</option>
                                <option value="to-neumes">Ноты → крюки</option>
                            </select>
                        </label>
                        <label className="flex flex-col gap-1">Распев
                            <select className={fieldClass} value={tradition} onChange={e => { setTradition(e.target.value as ChantTradition); setTone(""); reset(); }}>
                                <option value="znamenny">Знаменный</option>
                                <option value="demestvenny">Демественный</option>
                            </select>
                        </label>
                        <label className="flex flex-col gap-1">Глас
                            <select className={fieldClass} value={tone} onChange={e => { setTone(e.target.value); reset(); }}>
                                <option value="">Не задан</option>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </label>
                    </div>
                    <p className="text-sm text-slate-600">Глас ограничивает поиск записями с явным указанием этого гласа. Демественный каталог пока не содержит формул с гласами.</p>
                    <label htmlFor="kruczie-input" className="font-bold">{direction === "to-notes" ? "Крюковая запись" : "Нотная запись"}</label>
                    <textarea id="kruczie-input" rows={4} className={`${fieldClass} font-mono w-full`} value={input} maxLength={MAX_INPUT_LENGTH}
                        spellCheck={false} autoCapitalize="off" autoCorrect="off" aria-describedby="kruczie-input-help"
                        onChange={e => { setInput(e.target.value); reset(); }} />
                    <p id="kruczie-input-help" className="text-sm text-slate-600">
                        Введите только музыкальную строку в формате znamen.ru, без директив %з, %н и текста слогов.
                        Крюковые группы разделяйте пробелами; ноты можно писать слитно: с1м1 п2 м2.
                        До {MAX_INPUT_LENGTH} знаков. Предлагается не более восьми вариантов за один поиск.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button type="submit" className="rounded bg-red-900 text-white px-4 py-2 disabled:opacity-50" disabled={!input.trim() || busy}>
                            {busy ? "Выполняется перевод…" : "Преобразовать"}
                        </button>
                        <button type="button" className={buttonClass} onClick={() => { setInput(EXAMPLES[tradition][direction]); setTone(""); reset(); }}>Подставить пример</button>
                    </div>
                </fieldset>
            </form>
            <p className="text-sm text-slate-500">Вычисления выполняются в браузере. Библиотека и база загружаются при первом переводе; введённая запись не отправляется на сервер.</p>
            <div role="status" aria-live="polite">{busy ? "Загружаем базу и ищем известные соответствия…" : notice}</div>
            {error && <p role="alert" className="text-red-800">{error}</p>}
            {view && <section aria-label="Результат перевода" className="flex flex-col gap-4">
                <h2 className="font-bold">Варианты перевода: {view.candidates.length}</h2>
                <p className="text-sm text-slate-600">База: {view.datasetVersion}. Покрыто {view.result.coverage.covered} из {view.result.coverage.total} {view.result.coverage.unit === "notes" ? "нот" : "крюковых групп"}.</p>
                {view.result.truncated && <p className="text-amber-800">Поиск ограничен. Показаны найденные варианты; другие соответствия также возможны.</p>}
                {view.result.coverage.uncovered.length > 0 && <p className="text-amber-800">Не покрыты позиции: {view.result.coverage.uncovered.map(r => `${r.start + 1}–${r.end}`).join(", ")}.</p>}
                {!view.candidates.length && <p>Полных соответствий не найдено. Проверьте запись или попробуйте изменить глас и распев.</p>}
                <label className="flex flex-wrap items-center gap-2">Вид нот
                    <select className={fieldClass} value={noteStyle} onChange={e => setNoteStyle(e.target.value as NoteStyle)}>
                        <option value="round">Круглые</option>
                        <option value="kievan">Киевские квадратные</option>
                    </select>
                </label>
                <p className="text-xs text-slate-500">Оба варианта показаны в скрипичном ключе с одинаковыми высотами и длительностями. Знаки альтерации повторяются у каждой ноты.</p>
                {view.candidates.length > 0 && <div className="flex flex-col gap-2">
                    <label className="flex flex-wrap items-center gap-2">Темп, четвертей в минуту
                        <select className={fieldClass} value={bpm} onChange={event => { playback.stop(); setBpm(Number(event.target.value)); }}>
                            <option value={66}>66 — медленно</option>
                            <option value={96}>96 — ровно</option>
                            <option value={132}>132 — скоро</option>
                        </select>
                    </label>
                    <PitchReference tradition={tradition} tone={tone ? Number(tone) as Tone : undefined} value={pitchReference} onChange={value => { playback.stop(); setPitchReference(value); }} />
                    <p className="text-xs text-slate-500">Каждый вариант можно прослушать синтезированным тоном. Звук создаётся в браузере; одновременно звучит один вариант.</p>
                    <div role="status" aria-live="polite">{playback.active !== null ? `${playback.loading ? "Подготовка звука: вариант" : "Воспроизводится вариант"} ${playback.active + 1}` : ""}</div>
                    {playback.error && <p role="alert" className="text-red-800 text-sm">{playback.error}</p>}
                </div>}
                {view.candidates.map((candidate, index) => <article key={index} className="border border-slate-200 rounded p-4 flex flex-col gap-2 min-w-0">
                    <h3 className="font-bold">Вариант {index + 1} · {candidate.kind === "matched" ? "Известное соответствие" : "Составлен из известных соответствий"}</h3>
                    <TransposedScore notation={candidate.neumes} unicode={candidate.unicode} melody={candidate.melody} shift={shift} style={noteStyle} activeNote={playback.active === index ? playback.noteIndex : null} />
                    <div className="flex flex-wrap gap-2 text-sm">
                        <button className={buttonClass} type="button" aria-pressed={playback.active === index}
                            aria-label={`${playback.active === index ? "Остановить" : "Послушать"} вариант ${index + 1}`}
                            onClick={() => { if (playback.active === index) playback.stop(); else void playback.play(candidate.notes, index); }}>
                            {playback.active === index ? "Остановить" : "Послушать"}
                        </button>
                        <button className={buttonClass} type="button" onClick={() => openModal({ mode: "export", layers: { notation: candidate.neumes, melody: candidate.notes } })}>Экспорт варианта в znamen.ru</button>
                        <button className={buttonClass} type="button" onClick={async () => { try { const { transposeLayers } = await import("@/lib/kruczie/transposition"); const moved = await transposeLayers({ notation: candidate.neumes, melody: candidate.notes }, shift); await copy(direction === "to-notes" ? moved.melody! : moved.notation!); } catch (cause) { setError(cause instanceof Error ? cause.message : "Перенос не подтверждён"); } }}>Скопировать результат</button>
                        <button className={buttonClass} type="button" onClick={() => { setInput(direction === "to-notes" ? candidate.notes : candidate.neumes); setDirection(direction === "to-notes" ? "to-neumes" : "to-notes"); reset(); }}>Проверить обратный перевод исходного варианта</button>
                    </div>
                    <CorpusPreference ranking={candidate.ranking} />
                    <details className="text-sm text-slate-600">
                        <summary className="cursor-pointer">Основания ({candidate.origins.length})</summary>
                        <ul className="list-disc pl-5 mt-2">{candidate.origins.slice(0, 30).map((origin, i) => <li key={i}>{origin}</li>)}</ul>
                        {candidate.origins.length > 30 && <p className="mt-2">Показаны первые 30 оснований из {candidate.origins.length}.</p>}
                    </details>
                </article>)}
                {view.result.diagnostics.length > 0 && <details open className="text-sm">
                    <summary className="font-bold cursor-pointer">Диагностика ({view.result.diagnostics.length})</summary>
                    <ul className="list-disc pl-5 mt-2">{view.result.diagnostics.map((d, i) => <li key={i} className={d.severity === "error" ? "text-red-800" : "text-amber-800"}>
                        {DIAGNOSTICS[d.code] ?? d.message} <code className="text-xs">{d.code}</code>
                        {d.range && <span> · знаки {d.range.start + 1}–{d.range.end}</span>}
                    </li>)}</ul>
                </details>}
            </section>}
        </div>
    );
}
