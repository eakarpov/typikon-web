import Link from 'next/link';
import type { StudyReaderAttachment } from '@/lib/study/reader-contract';

const localUrl=(value:string)=>{const u=new URL(value,'https://www.typikon.info');return u.pathname+u.search+u.hash;};
const questionLabels:Record<string,string>={
  'q:chapter-author':'Авторство именно этой беседы требует проверки.',
  'q:chapter-translator':'Переводчик не установлен.',
  'q:witness-date':'Датировка рукописного свидетеля не установлена.',
};
export default function ReaderPassport({value}:{value:StudyReaderAttachment}){
  return <section className="my-4 border border-amber-800/40 rounded p-4 space-y-3" aria-label="Паспорт источника">
    <h3 className="font-serif text-lg">Паспорт источника</h3>
    {Object.entries(value.passport.fields).map(([name,field])=><p key={name}>{field.display}</p>)}
    <p>В паспорте пока нет установленной даты создания или перевода. Текст набран, но редакторская вычитка не завершена.</p>
    <nav className="flex flex-wrap gap-4" aria-label="Адреса источника">
      <Link className="underline" href={localUrl(value.permanentUrl)}>Постоянный адрес</Link>
      <Link className="underline" href={localUrl(value.versionUrl)}>Ссылка на эту версию</Link>
      <Link className="underline" href={localUrl(value.fragment.url)}>Фрагмент: глава целиком</Link>
    </nav>
    <details><summary className="cursor-pointer">Источники и открытые вопросы</summary>
      <ul className="list-disc pl-5 my-3">{value.passport.questions.filter(q=>q.status==='open').map(q=><li key={q.id}>{questionLabels[q.id]??q.reason}</li>)}</ul>
      <p>Атрибуция сборника, авторство отдельной беседы и сведения о рукописи рассматриваются отдельно.</p>
      <details><summary className="cursor-pointer">Свидетельства паспорта</summary><pre className="text-sm whitespace-pre-wrap break-words overflow-auto">{JSON.stringify({sources:value.passport.sources,observations:value.passport.observations,assertions:value.passport.assertions,cases:value.passport.cases},null,2)}</pre></details>
    </details>
  </section>;
}
