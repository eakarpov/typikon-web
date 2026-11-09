import Link from 'next/link';
import {readSharedNote} from '@/lib/companion/notesService';
export const dynamic = 'force-dynamic';
export const metadata = {title: 'Личная заметка к богослужению', robots: {index: false, follow: false}};
export default async function Page({params}: {params: Promise<{token: string}>}) {
  const note = await readSharedNote((await params).token);
  if (!note) return <main className="max-w-3xl mx-auto p-4"><h1>Заметка недоступна</h1><p>Она не опубликована или автор отключил доступ по ссылке.</p></main>;
  const query = new URLSearchParams({...note.selection, node: note.nodeId});
  return <main className="max-w-3xl mx-auto p-4 space-y-4">
    <h1 className="text-2xl font-bold">{note.title} · {note.nodeTitle}</h1>
    <p>Личная заметка автора. Не является редакционным пояснением Спутника.</p>
    <article className="whitespace-pre-wrap border rounded p-4">{note.text}</article>
    <p>Изменена: {note.updatedAt.slice(0,10)}</p>
    <Link className="underline" href={'/companion?' + query}>Открыть это место в Спутнике</Link>
  </main>;
}
