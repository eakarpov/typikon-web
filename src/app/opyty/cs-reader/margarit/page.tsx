import { Suspense } from 'react';
import Link from 'next/link';
import Client from '@/app/study/Client';
import { pilotChapter } from '@/lib/study/reader';
export const dynamic='force-dynamic';
export const metadata={title:'Маргарит — опыт чтения с паспортом',robots:{index:false,follow:false}};
export default function MargaritPilot(){
  return <><header className="max-w-6xl mx-auto px-4 py-4"><Link className="underline" href="/opyty/cs-reader">← Корпус ЦС — пилот</Link><p className="mt-2">Опыт: глава Маргарита с паспортом источника. Вычитка и проверка атрибуции продолжаются.</p></header>
    <Suspense fallback={<p>Открываю главу…</p>}><Client readerPilotTarget={{kind:'text',id:pilotChapter.nativeRef.id}}/></Suspense></>;
}
