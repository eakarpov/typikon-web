'use client';
import { useEffect, useState } from 'react';
import { readSavedCollections, removeCollectionSnapshot, type SavedCollection } from '@/lib/readingCollections/offline';
import { listSaved, forgetGroup, type SavedPage } from '@/lib/offline';
export default function SavedCollections() {
    const [rows, setRows] = useState<SavedCollection[]>([]), [pages, setPages] = useState<SavedPage[]>([]), [error, setError] = useState(''), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false);
    useEffect(() => { try {
        setRows(readSavedCollections());
    }
    catch (e) {
        setError(e instanceof Error ? e.message : String(e));
    } void listSaved().then(a => { if (a.ok)
        setPages(a.saved);
    else
        setError(a.error); }).finally(() => setLoaded(true)); }, []);
    async function remove(id: string) { setBusy(true); try {
        const a = await forgetGroup(`collection:${id}`);
        if (!a.ok)
            throw Error(a.error);
        removeCollectionSnapshot(id);
        setRows(readSavedCollections());
        setPages(a.saved);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : String(e));
    }
    finally {
        setBusy(false);
    } }
    if (!loaded)
        return <p role="status">Открываю сохранённые подборки…</p>;
    return <div className="space-y-5 font-serif"><p>Явно сохранённые подборки находятся в этом браузере и доступны без входа и сети. Их названия и состав останутся на устройстве до удаления. Порядок чтений сохранён.</p>{error && <p role="alert">{error}</p>}{!rows.length && <p>Пока нет сохранённых подборок. <a href="/reading-collections" className="underline">Открыть свои подборки</a></p>}{rows.map(row => <section key={row.id} className="border rounded p-3 space-y-2"><h2 className="font-bold">{row.title}</h2><p>Состав сохранён {new Date(row.savedAt).toLocaleString('ru-RU')}</p><ol>{row.items.map((item, n) => { const saved = pages.some(p => p.url === item.href); return <li key={n} className="py-2"><a className="underline" href={item.href}>{n + 1}. {item.title}</a><span className="block text-sm">{saved ? 'Страница сохранена' : 'Страница не сохранена; для открытия нужна сеть'}</span></li>; })}</ol><button className="min-h-11 border rounded p-2" disabled={busy} onClick={() => remove(row.id)}>Убрать подборку с этого устройства</button></section>)}</div>;
}
