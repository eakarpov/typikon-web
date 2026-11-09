'use client';
import {useEffect, useRef, useState} from 'react';
import type {Node, Service, Selection} from '@/lib/companion/core';
import type {PersonalNote} from '@/lib/companion/notes';

type Note = Omit<PersonalNote, 'userId'> & {published: boolean};
const btn = 'border rounded px-3 py-2 min-h-11 disabled:opacity-50';
export default function CompanionNotes({owner, service, node, selection}: {owner: string; service: Service; node: Node; selection: Selection}) {
  const [notes, setNotes] = useState<Note[]>([]), [text, setText] = useState(''), [editing, setEditing] = useState<Note | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false);
  const [link, setLink] = useState('');
  const draftId = useRef<string | null>(null);
  async function api(url: string, init?: RequestInit) {
    const r = await fetch(url, {...init, cache: 'no-store'}), b = await r.json();
    if (!r.ok) throw Error(b.error?.message ?? 'Не удалось сохранить заметку.');
    if (b.userId !== owner.replace(/^user:/, '')) throw Error('Вход изменился. Откройте Спутник заново.');
    return b;
  }
  useEffect(() => {
    if (owner === 'guest') return;
    let active = true;
    void api('/api/v2/companion/notes?' + new URLSearchParams({sessionKey: service.sessionKey, nodeId: node.id})).then(b => {if (active) {setNotes(b.notes); setLoaded(true);}}).catch(e => {if (active) setError(e.message);});
    return () => {active = false;};
    // Parent keys this component by owner and exact occurrence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setError('');
    try {const b = await api('/api/v2/companion/notes?' + new URLSearchParams({sessionKey: service.sessionKey, nodeId: node.id})); setNotes(b.notes); setLoaded(true);} catch(e) {setError((e as Error).message);}
  }
  async function save(published: boolean) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const b = await api('/api/v2/companion/notes', {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id: editing?.id ?? (draftId.current ??= crypto.randomUUID().replaceAll('-', '').slice(0,24)), expectedRevision: editing?.revision ?? 0, expectedSharingRevision: editing?.sharingRevision ?? 0, expectedUserId: owner.replace(/^user:/, ''), sessionKey: service.sessionKey, nodeId: node.id, contentHash: node.contentHash, title: service.title, nodeTitle: node.title, selection, text, published})});
      setNotes(old => [b.note, ...old.filter(n => n.id !== b.note.id)]);
      setEditing(b.note); setText(b.note.text);
      setLink(b.note.shareToken ? location.origin + '/notes/shared/' + b.note.shareToken : '');
    } catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  return <section className="border-t pt-4 space-y-3" aria-label="Мои заметки к части службы">
    <h4 className="font-bold">Мои заметки к этому месту</h4>
    {owner === 'guest' ? <p>Для сохранения личных заметок <a className="underline" href="/profile">войдите в аккаунт</a>.</p> : <>
      <button className={btn} disabled={busy} onClick={() => void refresh()}>Обновить список заметок</button>
      {notes.map(n => <div key={n.id} className="border rounded p-3">
        <p className="whitespace-pre-wrap">{n.text}</p><p>{n.published ? 'Доступна по ссылке' : 'Приватная'}</p>
        {n.contentHash !== node.contentHash && <p>Текст этой части изменился после записи заметки.</p>}
        <button className={btn} disabled={busy} onClick={() => {setEditing(n); setText(n.text); setLink(n.shareToken ? location.origin + '/notes/shared/' + n.shareToken : '');}}>Изменить и настроить доступ</button>
      </div>)}
      {loaded && !notes.length && <p>К этой части пока нет личных заметок.</p>}
      <label className="block">{editing ? 'Редактировать заметку' : 'Новая приватная заметка'}<textarea className="block border rounded w-full p-2" maxLength={10000} value={text} onChange={e => setText(e.target.value)} rows={4}/></label>
      <p>Публичную заметку сможет прочитать любой, у кого есть ссылка. Это личная запись автора, а не редакционное пояснение.</p>
      <div className="flex gap-2 flex-wrap">
        <button className={btn} disabled={busy || !text.trim()} onClick={() => void save(editing?.published ?? false)}>Сохранить{editing?.published ? ' изменения' : ' приватно'}</button>
        <button className={btn} disabled={busy || !text.trim()} onClick={() => {if (!editing?.published && !window.confirm('Опубликовать эту заметку? Любой получатель ссылки увидит её текст и место службы.')) return; void save(!editing?.published);}}>{editing?.published ? 'Отключить доступ по ссылке' : 'Опубликовать по ссылке'}</button>
        {editing && <button className={btn} disabled={busy} onClick={() => {setEditing(null); draftId.current = null; setText(''); setLink('');}}>Новая заметка</button>}
      </div>
      {link && <div><label>Ссылка на заметку<input className="block border rounded w-full p-2" readOnly value={link} onFocus={e => e.target.select()}/></label><button className={btn} onClick={() => void navigator.clipboard.writeText(link).catch(() => setError('Скопируйте ссылку из поля выше.'))}>Скопировать ссылку</button></div>}
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
