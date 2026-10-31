'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
export function ReadingToolbar({ mode }: {
    mode: ReturnType<typeof useReadingFocus>;
}) {
    const [values, setValues] = useState<Record<string, string>>({});
    useEffect(() => setValues(readStored()), []);
    return <div className="reading-toolbar no-pdf flex gap-2 flex-wrap items-start py-3">
 <button ref={mode.button} className="min-h-11 border rounded px-3 py-2" aria-pressed={mode.focus} onClick={() => mode.setFocus(!mode.focus)}>{mode.focus ? 'Выйти из режима чтения' : 'Сосредоточенное чтение'}</button>
 <details><summary className="min-h-11 cursor-pointer border rounded px-3 py-2">Настроить текст</summary><div className="space-y-2 p-3 border rounded">{READING_SETTINGS.filter(s => ['fontSize', 'lineHeight', 'measure'].includes(s.id)).map(s => <label className="block" key={s.id}>{s.label}<select className="block border p-2 max-w-full" value={values[s.id] || s.fallback} onChange={e => { applyValue(s, e.target.value); storeValue(s, e.target.value); setValues(v => ({ ...v, [s.id]: e.target.value })); }}>{s.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}<a className="underline block min-h-11 py-2" href="/settings">Все настройки чтения</a></div></details>
 {mode.focus && <span className="text-sm py-3">Escape — вернуться к обычному виду</span>}
 </div>;
}
export default function ReadingFocus({ children, title }: {
    children: ReactNode;
    title: string;
}) { const mode = useReadingFocus(); return <div data-reading-surface className="min-w-0"><ReadingToolbar mode={mode}/>{mode.focus && <h1 className="font-bold text-xl pb-3">{title}</h1>}{children}</div>; }
