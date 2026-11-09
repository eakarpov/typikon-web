import Link from 'next/link';
import {sharedNote} from '@/lib/notes/sharing';
export const dynamic='force-dynamic';
export const metadata={title:'Личная заметка',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{token:string}>}){
  const n=await sharedNote((await params).token);
  if(!n)return <main className="max-w-3xl mx-auto p-4"><h1>Заметка недоступна</h1><p>Она не опубликована или автор отключил доступ по ссылке.</p></main>;
  return <main className="max-w-3xl mx-auto p-4 space-y-4"><h1 className="text-2xl font-bold">{n.source.title}</h1><p>Личная заметка автора. Не является редакционным пояснением.</p>{n.source.quote&&<blockquote className="border-l pl-4 whitespace-pre-wrap">{n.source.quote}</blockquote>}<article className="whitespace-pre-wrap border rounded p-4">{n.text}</article><p>Изменена: {n.updatedAt.slice(0,10)}</p>{n.source.href&&<Link className="underline" href={n.source.href}>Открыть исходное место</Link>}</main>;
}
