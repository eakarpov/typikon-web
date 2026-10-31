'use client';
import { saveCollectionSnapshot } from '@/lib/readingCollections/offline';
import { useEffect, useState } from 'react';
import type { ReadingCollection } from '@/lib/readingCollections/core';
import { saveMany, isSupported, type SaveProgress } from '@/lib/offline';
const button = 'min-h-11 border rounded px-3 py-2 disabled:opacity-50';
export default function CollectionManager() {
    const [rows, setRows] = useState<ReadingCollection[]>([]), [title, setTitle] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [login, setLogin] = useState(false), [loaded, setLoaded] = useState(false), [share, setShare] = useState(''), [progress, setProgress] = useState<SaveProgress | null>(null);
    useEffect(() => {
        fetch('/api/reading-collections', { cache: 'no-store' }).then(async (r) => {
            if (r.status === 401) {
                setLogin(true);
                return [];
            }
            if (!r.ok)
                throw Error('Не удалось загрузить подборки.');
            return r.json();
        }).then(setRows).catch(e => setError(e.message)).finally(() => setLoaded(true));
    }, []);
    async function action(b: object) {
        setBusy(true);
        setError('');
        try {
            const r = await fetch('/api/reading-collections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
            const a = await r.json();
            if (!r.ok)
                throw Error(a.error || 'Не удалось сохранить подборку.');
            setRows(a.collections);
            return a.id as string;
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setBusy(false);
        }
    }
    async function save(row: ReadingCollection) {
        setBusy(true);
        setError('');
        try {
            await navigator.storage?.persist?.().catch(() => false);
            const r = await saveMany([...row.items.map(i => ({ url: i.href, label: i.title })), { url: '/saved-collections', label: 'Сохранённые подборки' }], `collection:${row.id}`, setProgress);
            if (!r.ok)
                throw Error(r.error);
            saveCollectionSnapshot(row, r.failed ?? []);
            setError(r.failed?.length ? `Не сохранены: ${r.failed.join(', ')}` : 'Подборка и порядок чтений сохранены. Откройте раздел «Сохранённые подборки».');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setBusy(false);
        }
    }
    if (!loaded)
        return <p role="status">Загружаю подборки…</p>;
    if (login)
        return <p><a className="underline" href="/login">Войдите</a>, чтобы сохранять свои подборки.</p>;
    return <div className="space-y-5 max-w-3xl font-serif"><a className="underline" href="/saved-collections">Сохранённые подборки на этом устройстве</a><p>Добавляйте произведения и статии со страниц чтений. Порядок можно менять. Подборки личные, пока вы не опубликуете отдельный снимок состава.</p>
 <form className="flex gap-2 flex-wrap" onSubmit={e => {
            e.preventDefault();
            void action({ action: 'create', title }).then(id => {
                if (id)
                    setTitle('');
            });
        }}><label>Новая подборка<input required maxLength={120} className="block border p-2" value={title} onChange={e => setTitle(e.target.value)}/></label><button className={button} disabled={busy}>Создать</button></form>
 {error && <p role="status">{error}</p>}{busy && progress && <p role="status">Сохранено {progress.done} из {progress.total}</p>}
 {share && <p>Ссылка на опубликованный снимок: <a className="underline break-all" href={share}>{share}</a></p>}
 {rows.map(row => <section key={row.id} className="border rounded p-3 space-y-3"><h2 className="font-bold">{row.title}</h2><p>Чтений: {row.items.length}</p>
 <ol className="space-y-2">{row.items.map((item, i) => <li key={`${item.textId}:${item.statia}:${i}`} className="border-b pb-2"><a className="underline block py-2" href={item.href}>{i + 1}. {item.title}</a><div className="flex gap-2 flex-wrap">{[-1, 1].map(d => <button key={d} className={button} disabled={busy || i + d < 0 || i + d >= row.items.length} aria-label={`${d < 0 ? 'Поднять' : 'Опустить'}: ${item.title}`} onClick={() => { const items = [...row.items]; [items[i], items[i + d]] = [items[i + d], items[i]]; void action({ action: 'update', id: row.id, revision: row.revision, items }); }}>{d < 0 ? 'Выше' : 'Ниже'}</button>)}<button className={button} disabled={busy} aria-label={`Убрать: ${item.title}`} onClick={() => action({ action: 'update', id: row.id, revision: row.revision, items: row.items.filter((_, n) => n !== i) })}>Убрать</button></div></li>)}</ol>
 <div className="flex gap-2 flex-wrap"><button className={button} disabled={busy} onClick={() => {
                const name = window.prompt('Название подборки', row.title);
                if (name)
                    void action({ action: 'update', id: row.id, revision: row.revision, title: name, items: row.items });
            }}>Переименовать</button>
 <button className={button} disabled={busy || !row.items.length || !isSupported()} onClick={() => save(row)}>Сохранить подборку без сети</button>
 <button className={button} disabled={busy || !row.items.length} onClick={() => {
                if (window.confirm('Опубликовать снимок названия и состава? Его сможет открыть любой, у кого есть ссылка.'))
                    void action({ action: 'publish', id: row.id, revision: row.revision }).then(token => {
                        if (token)
                            setShare(`${location.origin}/reading-collections/shared/${token}`);
                    });
            }}>Опубликовать копию</button>
 <button className={button} disabled={busy} onClick={() => {
                if (window.confirm('Закрыть все опубликованные копии этой подборки?'))
                    void action({ action: 'unpublish', id: row.id, revision: row.revision }).then(() => setShare(''));
            }}>Закрыть опубликованные копии</button>
 <button className={button} disabled={busy} onClick={() => {
                if (window.confirm('Удалить подборку и закрыть ссылки на её опубликованные копии?'))
                    void action({ action: 'delete', id: row.id, revision: row.revision });
            }}>Удалить подборку</button></div></section>)}
 </div>;
}
