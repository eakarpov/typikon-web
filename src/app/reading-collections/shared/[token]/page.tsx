import { notFound } from 'next/navigation';
import { sharedCollection } from '@/lib/readingCollections/service';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Подборка чтений', robots: { index: false, follow: false } };
export default async function Page({ params }: {
    params: {
        token: string;
    };
}) { const row = await sharedCollection(params.token); if (!row)
    notFound(); return <main className="py-4 space-y-4 max-w-3xl"><h1 className="font-bold text-xl">{row.title}</h1><p>Опубликованная копия состава. Последующие изменения личной подборки её не меняют. Тексты открываются в актуальной редакции корпуса.</p><ol>{row.items.map((i, n) => <li className="py-2" key={n}><a className="underline" href={i.href}>{n + 1}. {i.title}</a></li>)}</ol></main>; }
