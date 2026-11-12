"use client";
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SERVICE_SIGNS } from '@/lib/parish/dayConfig';
import type { ParishDay } from '@/lib/parish/types';
import { parishMutation } from '@/lib/parish/client';
import { useParishWrite } from './useParishWrite';
type Memory = {
    memoryId: string;
    label: string;
    sign: string | null;
    month?: number | null;
    day?: number | null;
};
const field = 'border rounded px-2 py-1 bg-white';
export default function DayEditor({ slug, period, day }: {
    slug: string;
    period: string;
    day: ParishDay;
}) {
    const router = useRouter(), { pending, error, run } = useParishWrite();
    const [open, setOpen] = useState(false), [memories, setMemories] = useState(day.dayConfig?.memories ?? []), [sign, setSign] = useState(day.dayConfig?.sign ?? '');
    const [extra, setExtra] = useState<Memory[]>([]), [query, setQuery] = useState(''), [month, setMonth] = useState(''), [date, setDate] = useState(''), [found, setFound] = useState<Memory[]>([]), [searchError, setSearchError] = useState(''), [loading, setLoading] = useState(false);
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => { if (!open)
        return; const node = dialog.current; node?.showModal(); return () => node?.close(); }, [open]);
    useEffect(() => {
        if (!open)
            return;
        const ctrl = new AbortController();
        setSearchError('');
        setFound([]);
        if (!query.trim() && !month && !date) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const timer = setTimeout(() => {
            const p = new URLSearchParams({ q: query, month, day: date });
            fetch('/api/parish/memories?' + p, { signal: ctrl.signal }).then(async (r) => { if (!r.ok)
                throw Error('Не удалось найти святых'); return r.json(); }).then(setFound).catch(e => { if (!ctrl.signal.aborted)
                setSearchError(e.message); }).finally(() => { if (!ctrl.signal.aborted)
                setLoading(false); });
        }, 250);
        return () => { clearTimeout(timer); ctrl.abort(); };
    }, [open, query, month, date]);
    const choices = [...(day.memoryChoices ?? []), ...extra].filter((m, i, a) => a.findIndex(n => n.memoryId === m.memoryId) === i);
    const defaultSign = memories.length ? choices.find(m => m.memoryId === memories[0])?.sign ?? 'bez-znaka' : day.sign;
    const defaultSignLabel = SERVICE_SIGNS.find(s => s[0] === defaultSign)?.[1] ?? defaultSign;
    const save = (reset = false) => run(async () => {
        await parishMutation('/api/parish/' + slug + '/day', 'POST', { period, date: day.date, memories: reset ? [] : memories, sign: reset ? null : sign || null, morningLiturgies:reset?null:day.dayConfig?.morningLiturgies??null });
        router.refresh();
    });
    return <details className="font-serif text-sm mt-2 whitespace-normal"><summary className="cursor-pointer text-blue-800">Святой и знак службы</summary>
 <p className="text-xs text-slate-500 my-1">Церковный день {day.date}: вечерня накануне и утреня. По умолчанию — уставный состав; при выборе святого знак берётся из его службы.</p>
 <div className="flex flex-col gap-1 max-h-56 overflow-auto">{choices.map(m => <label key={m.memoryId} className="flex gap-2 items-baseline"><input type="checkbox" disabled={pending} checked={memories.includes(m.memoryId)} onChange={e => setMemories(e.target.checked ? [...memories, m.memoryId] : memories.filter(x => x !== m.memoryId))}/>{m.label}{memories[0] === m.memoryId && <span className="text-slate-500"> (главный)</span>}{memories.includes(m.memoryId) && memories[0] !== m.memoryId && <button type="button" className="underline" onClick={e => { e.preventDefault(); setMemories([m.memoryId, ...memories.filter(id => id !== m.memoryId)]); }}>Сделать главным</button>}</label>)}</div>
 <button type="button" className="underline my-2" onClick={() => setOpen(true)}>Перенос</button>
 <label className="block">Знак службы <select className={field} value={sign} disabled={pending} onChange={e => setSign(e.target.value)}><option value="">По святому / по уставу ({defaultSignLabel})</option>{SERVICE_SIGNS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select></label>
 <div className="flex gap-3 my-2"><button type="button" disabled={pending} className="underline" onClick={() => save()}>Сохранить день</button><button type="button" disabled={pending} className="underline" onClick={() => save(true)}>Вернуть уставный вариант</button></div>
 {error && <p role="alert" className="text-red-800">{error}</p>}
 {open && <dialog ref={dialog} onCancel={() => setOpen(false)} className="rounded border p-5 w-[min(95vw,42rem)] backdrop:bg-black/40"><div className="flex justify-between gap-3"><h2 className="text-lg">Перенос службы святому</h2><button type="button" onClick={() => setOpen(false)} aria-label="Закрыть">✕</button></div>
 <label className="block my-2">Поиск по всем святым<input autoFocus type="search" className={field + ' w-full'} value={query} onChange={e => setQuery(e.target.value)}/></label>
 <div className="flex gap-2 flex-wrap"><label>Церковный месяц <select className={field} value={month} onChange={e => setMonth(e.target.value)}><option value="">Любой</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label><label>Число <input type="number" min={1} max={31} value={date} className={field + ' w-16'} onChange={e => setDate(e.target.value)}/></label></div>
 <p className="text-xs text-slate-500 my-2">Дата по церковному календарю. Можно искать по имени, дате или вместе. Первые 100 совпадений.</p>
 {loading && <p role="status">Поиск…</p>}{searchError && <p role="alert">{searchError}</p>}
 <ul className="max-h-80 overflow-auto">{found.map(m => <li key={m.memoryId} className="border-t py-2">{m.label} {m.month && m.day ? `(${m.day}.${m.month})` : ''}<button className="underline ml-2" type="button" onClick={() => { setExtra([...extra, m]); setMemories([m.memoryId, ...memories.filter(id => id !== m.memoryId)]); setOpen(false); }}>Выбрать</button></li>)}</ul>
 {!loading && !searchError && !!(query || month || date) && !found.length && <p>Ничего не найдено.</p>}
 </dialog>}
 </details>;
}
