'use client';
import { useEffect, useRef, useState } from 'react';
import { decodeWorkDraft, type SavedWorkDraft } from '@/lib/kruczie/workDraft';
import { copyProject, exportProject, importProject, listProjects, migrateLegacyProject, readProject, removeProject, renameProject, type ChantProject } from '@/lib/kruczie/projects';
const button = 'min-h-11 border rounded px-3 py-2 disabled:opacity-50';
export default function ProjectShelf({ onOpen }: {
    onOpen: (id: string, draft: SavedWorkDraft) => void;
}) {
    const [rows, setRows] = useState<ChantProject[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    useEffect(() => { migrateLegacyProject().then(() => setRows(listProjects())).catch(e => setError(e.message)); const update = () => { try {
        setRows(listProjects());
    }
    catch (e) {
        setError(e instanceof Error ? e.message : String(e));
    } }; window.addEventListener('storage', update); return () => window.removeEventListener('storage', update); }, []);
    async function run(action: () => Promise<unknown> | unknown) { setBusy(true); setError(''); try {
        await action();
        setRows(listProjects());
    }
    catch (e) {
        setError(e instanceof Error ? e.message : String(e));
    }
    finally {
        setBusy(false);
    } }
    function download(id: string) { const p = readProject(id); const url = URL.createObjectURL(new Blob([exportProject(id)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `${p.title.replace(/[^\p{L}\p{N}_-]/gu, '-')}.kruczie.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    return <section className="border rounded p-3 space-y-3" aria-label="Проекты мастерской"><h2 className="font-bold">Мои проекты</h2><p className="text-sm">Проекты хранятся в этом браузере. Файл проекта переносит исходные блоки, выбранные варианты и ручные правки, в том числе незавершённые. Копия позволяет сравнивать разные разборы.</p>
 <input ref={input} type="file" accept=".json,.kruczie.json,application/json" className="sr-only" aria-label="Открыть файл проекта" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file)
        return; void run(async () => { if (file.size > 2200000)
        throw Error('Файл проекта слишком большой.'); const p = await importProject(await file.text()); onOpen(p.id, await decodeWorkDraft(p.draft)); }); }}/>
 <button className={button} disabled={busy} onClick={() => input.current?.click()}>Импортировать файл проекта</button>{error && <p role="alert">{error}</p>}
 {!rows.length && <p>Пока нет проектов. Импортируйте целое произведение из znamen.ru или откройте файл проекта.</p>}
 <ul className="space-y-3">{rows.map(p => <li key={p.id} className="border-t pt-2"><p className="font-bold break-words">{p.title}</p><p className="text-xs">{new Date(p.updatedAt).toLocaleString('ru-RU')}</p><div className="flex flex-wrap gap-2 mt-2">
 <button className={button} disabled={busy} onClick={() => run(async () => onOpen(p.id, await decodeWorkDraft(readProject(p.id).draft)))}>Открыть</button>
 <button className={button} disabled={busy} onClick={() => run(() => { const title = window.prompt('Название проекта', p.title); if (title)
            renameProject(p.id, title); })}>Переименовать</button>
 <button className={button} disabled={busy} onClick={() => run(() => copyProject(p.id))}>Сделать копию</button>
 <button className={button} disabled={busy} onClick={() => run(() => download(p.id))}>Скачать проект</button>
 <button className={button} disabled={busy} onClick={() => run(() => { if (window.confirm('Удалить проект из этого браузера? Скачайте файл, если хотите сохранить разбор.'))
            removeProject(p.id); })}>Удалить</button>
 </div></li>)}</ul></section>;
}
