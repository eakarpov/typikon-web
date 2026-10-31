'use client';
import { useEffect, useState } from 'react';
import { nextDate } from '@/lib/readingPlan/core';
import type { OfflineDay } from '@/lib/offlineReadings';
import { listSaved, saveMany, forgetGroup, isSupported, formatBytes, type SavedPage, type SaveProgress } from '@/lib/offline';
const button = 'min-h-11 border rounded px-3 py-2 disabled:opacity-50';
export default function WeekManager() {
    const [from, setFrom] = useState(''), [to, setTo] = useState(''), [days, setDays] = useState<OfflineDay[]>([]), [lang, setLang] = useState(''), [saved, setSaved] = useState<SavedPage[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [progress, setProgress] = useState<SaveProgress | null>(null);
    useEffect(() => { const today = new Date().toLocaleDateString('sv-SE'); setFrom(today); let last = today; for (let i = 0; i < 6; i++)
        last = nextDate(last); setTo(last); void reload(); }, []);
    async function reload() { const a = await listSaved(); if (a.ok)
        setSaved(a.saved); }
    function dates(a: string, b: string) { setFrom(a); setTo(b); setDays([]); setProgress(null); setError(''); }
    async function preview() { setBusy(true); setError(''); setDays([]); try {
        const r = await fetch('/api/offline-readings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to }) });
        const b = await r.json();
        if (!r.ok)
            throw Error(b.error || 'Не удалось собрать состав.');
        setDays(b.days);
        setLang(b.lang);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : String(e));
    }
    finally {
        setBusy(false);
    } }
    const group = `week:${from}:${to}:${lang}`;
    const has = (url: string) => saved.some(p => p.url === url);
    async function save() { setBusy(true); setError(''); setProgress(null); await navigator.storage?.persist?.().catch(() => false); const a = await saveMany([...days.filter(d => d.available).map(d => ({ url: `/calculator/${d.date}`, label: `${d.date} · ${d.title}` })), { url: '/offline-readings', label: 'Сохранённые чтения по дням' }], group, setProgress); setBusy(false); if (a.ok) {
        setSaved(a.saved);
        if (a.failed?.length)
            setError(`Не сохранены: ${a.failed.join(', ')}. Можно повторить сохранение.`);
    }
    else
        setError(a.error); }
    const groups = [...new Set(saved.flatMap(p => p.groups ?? (p.group ? [p.group] : [])).filter(g => g.startsWith('week:')))];
    return <div className="space-y-4 max-w-3xl font-serif"><p>Сохраните неделю или свой диапазон до 31 дня. Чтения останутся в этом браузере; перед поездкой откройте их без сети и убедитесь, что всё нужное на месте.</p>
 <form className="flex gap-3 flex-wrap items-end" onSubmit={e => { e.preventDefault(); void preview(); }}>
 <label>С даты<input required disabled={busy} className="block border p-2" type="date" min="1900-01-01" max="2099-12-31" value={from} onChange={e => dates(e.target.value, to)}/></label>
 <label>По дату<input required disabled={busy} className="block border p-2" type="date" min="1900-01-01" max="2099-12-31" value={to} onChange={e => dates(from, e.target.value)}/></label>
 <button className={button} disabled={busy}>Показать состав</button></form>
 {error && <p role="alert">{error}</p>}{busy && <p role="status">{progress ? `Сохранено ${progress.done} из ${progress.total}` : 'Собираю чтения…'}</p>}
 {!!days.length && <section className="space-y-2"><h2 className="font-bold">Состав пакета</h2><p>Полные страницы чтений дня, включая назначенные фрагменты. Ссылка на всё произведение потребует отдельного сохранения.</p><ul className="space-y-2">{days.map(d => <li key={d.date}>{d.date} · {d.title} · {!d.available ? 'нет данных дня' : has(`/calculator/${d.date}`) ? 'страница сохранена' : 'ещё не сохранено'}</li>)}</ul>
 <button className={button} disabled={busy || !isSupported() || !days.some(d => d.available)} onClick={save}>Сохранить или обновить пакет</button>{!isSupported() && <p>Офлайн-сохранение недоступно в этом браузере или режиме.</p>}</section>}
 <section className="space-y-3"><h2 className="font-bold">Сохранённые диапазоны</h2>{!groups.length && <p>Пока нет сохранённых диапазонов.</p>}{groups.map(g => { const rows = saved.filter(p => (p.groups ?? (p.group ? [p.group] : [])).includes(g)); const [, a, b] = g.split(':'); return <details key={g}><summary className="min-h-11 cursor-pointer py-2">{a} — {b} · {rows.filter(p => p.url.startsWith('/calculator/')).length} дней</summary><ul>{rows.map(p => <li key={p.url}><a href={p.url} className="underline block py-2">{p.label} · {formatBytes(p.bytes)}</a></li>)}</ul><button className={button} disabled={busy} onClick={async () => { setBusy(true); const r = await forgetGroup(g); if (!r.ok)
        setError(r.error); await reload(); setBusy(false); }}>Убрать этот пакет</button></details>; })}</section></div>;
}
