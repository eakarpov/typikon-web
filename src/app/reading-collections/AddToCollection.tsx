'use client';
import { useEffect, useState } from 'react';
import type { ReadingCollection } from '@/lib/readingCollections/core';
export default function AddToCollection({ textId, statia, compact = false }: {
    textId: string;
    statia?: number;
    compact?: boolean;
}) {
    const [rows, setRows] = useState<ReadingCollection[]>([]), [selected, setSelected] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
    useEffect(() => { fetch('/api/reading-collections', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then(setRows).catch(() => { }); }, []);
    async function add() { const row = rows.find(r => r.id === selected); if (!row)
        return; setBusy(true); try {
        const r = await fetch('/api/reading-collections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'append', id: row.id, revision: row.revision, item: { textId, statia } }) });
        const b = await r.json();
        if (!r.ok)
            throw Error(b.error || 'Не удалось добавить чтение.');
        setRows(b.collections);
        setMessage('Добавлено в подборку.');
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : String(e));
    }
    finally {
        setBusy(false);
    } }
    return <details className={compact ? "relative pr-4 text-amber-800 no-pdf" : "py-2 no-pdf"}><summary className={compact ? "cursor-pointer whitespace-nowrap" : "min-h-11 cursor-pointer py-2"}>Добавить {statia ? 'статию' : 'произведение'} в подборку</summary><div className={compact ? "absolute left-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded border bg-white p-3 font-normal text-stone-800 shadow-lg" : undefined}><p><a className="underline" href="/reading-collections">Создать или открыть свои подборки</a></p>{!!rows.length && <div className="flex gap-2 flex-wrap"><label>Подборка<select className="block border p-2 max-w-full" value={selected} onChange={e => setSelected(e.target.value)}><option value="">Выберите подборку</option>{rows.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label><button className="min-h-11 border rounded p-2" disabled={busy || !selected} onClick={add}>Добавить</button></div>}{message && <p role="status">{message}</p>}</div></details>;
}
