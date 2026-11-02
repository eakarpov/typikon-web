'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { READING_SETTINGS, readStored, applyValue, storeValue } from '@/lib/settings/reading';
export function useReadingFocus() {
    const [focus, setFocus] = useState(false);
    const button = useRef<HTMLButtonElement>(null);
    const wasFocused = useRef(false);
    useEffect(() => { if (wasFocused.current && !focus)
        button.current?.focus(); wasFocused.current = focus; if (focus)
        document.documentElement.dataset.readingFocus = 'true';
    else
        delete document.documentElement.dataset.readingFocus; const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && focus) {
        setFocus(false);
        button.current?.focus();
    } }; window.addEventListener('keydown', escape); return () => { delete document.documentElement.dataset.readingFocus; window.removeEventListener('keydown', escape); }; }, [focus]);
    return { focus, setFocus, button };
}
const ReadingFocusContext = createContext<ReturnType<typeof useReadingFocus> | null>(null);

export function ReadingFocusActions() {
    const mode = useContext(ReadingFocusContext);
    return mode ? <ReadingToolbar mode={mode} compact /> : null;
}

export function ReadingToolbar({ mode, compact = false }: {
    mode: ReturnType<typeof useReadingFocus>;
    compact?: boolean;
}) {
    const [values, setValues] = useState<Record<string, string>>({});
    useEffect(() => setValues(readStored()), []);
    const controlClass = compact ? "cursor-pointer whitespace-nowrap" : "min-h-11 border rounded px-3 py-2";
    return <div className={compact
        ? "reading-toolbar no-pdf inline-flex flex-wrap gap-x-4 gap-y-1 items-center max-w-full pr-4 text-amber-800"
        : "reading-toolbar no-pdf flex gap-2 flex-wrap items-start py-3"}>
 <button ref={mode.button} className={controlClass} aria-pressed={mode.focus} onClick={() => mode.setFocus(!mode.focus)}>{mode.focus ? 'Выйти из режима чтения' : 'Сосредоточенное чтение'}</button>
 <details className="relative"><summary className={compact ? "cursor-pointer whitespace-nowrap" : "min-h-11 cursor-pointer border rounded px-3 py-2"}>Настроить текст</summary><div className={compact ? "absolute right-0 top-full z-20 mt-2 w-64 space-y-2 p-3 border rounded bg-white text-stone-800 font-normal shadow-lg" : "space-y-2 p-3 border rounded"}>{READING_SETTINGS.filter(s => ['fontSize', 'lineHeight', 'measure'].includes(s.id)).map(s => <label className="block" key={s.id}>{s.label}<select className="block border p-2 max-w-full" value={values[s.id] || s.fallback} onChange={e => { applyValue(s, e.target.value); storeValue(s, e.target.value); setValues(v => ({ ...v, [s.id]: e.target.value })); }}>{s.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}<a className="underline block min-h-11 py-2" href="/settings">Все настройки чтения</a></div></details>
 {mode.focus && <span className="text-sm py-3">Escape — вернуться к обычному виду</span>}
 </div>;
}
export default function ReadingFocus({ children, title, header }: {
    children: ReactNode;
    title: string;
    /** Шапка с компактными действиями, скрываемая в сосредоточенном режиме. */
    header?: ReactNode;
}) {
    const mode = useReadingFocus();
    return <ReadingFocusContext.Provider value={mode}>
        {header}
        <div data-reading-surface className="min-w-0">
            {(!header || mode.focus) && <ReadingToolbar mode={mode} />}
            {mode.focus && <h1 className="font-bold text-xl pb-3">{title}</h1>}
            {children}
        </div>
    </ReadingFocusContext.Provider>;
}
