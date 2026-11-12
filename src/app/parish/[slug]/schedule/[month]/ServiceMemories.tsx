'use client';
import { useEffect, useState } from 'react';
import type { ServiceMemory } from '@/lib/parish/serviceDetails';
export default function ServiceMemories({ title, value, onChange, max, choices = [] }: {
    title: string;
    value: ServiceMemory[];
    onChange: (value: ServiceMemory[]) => void;
    max: number;
    choices?: ServiceMemory[];
}) {
    const [q, setQ] = useState(''), [month, setMonth] = useState(''), [day, setDay] = useState(''), [found, setFound] = useState<ServiceMemory[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(false);
    useEffect(() => {
        const ctrl = new AbortController();
        setFound([]);
        setError('');
        if (!q.trim() && !month && !day) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const timer = setTimeout(() => { fetch('/api/parish/memories?' + new URLSearchParams({ q, month, day }), { signal: ctrl.signal }).then(async (r) => { if (!r.ok)
            throw Error('Не удалось загрузить памяти'); return r.json(); }).then(setFound).catch(e => { if (!ctrl.signal.aborted)
            setError(e.message); }).finally(() => { if (!ctrl.signal.aborted)
            setLoading(false); }); }, 250);
        return () => { clearTimeout(timer); ctrl.abort(); };
    }, [q, month, day]);
    const list = [...value, ...(q.trim() || month || day ? found : choices)].filter((m, i, a) => a.findIndex(n => n.memoryId === m.memoryId) === i);
    return <fieldset className="border rounded p-2 my-2"><legend>{title} — до {max} памятей ({value.length}/{max})</legend>
 <label className="block">Поиск по всем памятям<input type="search" value={q} onChange={e => setQ(e.target.value)} className="border rounded px-2 py-1 w-full"/></label>
 <div className="flex gap-2 my-1"><label>Церковный месяц <input aria-label={title + ' — церковный месяц'} type="number" min={1} max={12} value={month} onChange={e => setMonth(e.target.value)} className="border rounded w-16"/></label><label>Число <input aria-label={title + ' — церковное число'} type="number" min={1} max={31} value={day} onChange={e => setDay(e.target.value)} className="border rounded w-16"/></label></div>
 {loading && <p role="status">Поиск…</p>}{error && <p role="alert" className="text-red-800">{error}</p>}
 <div className="max-h-48 overflow-auto">{list.map(m => <label key={m.memoryId} className="flex gap-2 items-baseline"><input type="checkbox" checked={value.some(v => v.memoryId === m.memoryId)} disabled={value.length >= max && !value.some(v => v.memoryId === m.memoryId)} onChange={e => onChange(e.target.checked ? [...value, m] : value.filter(v => v.memoryId !== m.memoryId))}/>{m.label}</label>)}</div>
 {!list.length && <p className="text-slate-500">Найдите святого или праздник по имени либо церковной дате.</p>}
 </fieldset>;
}
