import Link from 'next/link';
import {parishScheduleHref,type SchedulePeriodType} from '@/lib/parish/period';
import PeriodSelector from './PeriodSelector';
export default function ScheduleTools({slug,period,type,anchor,why,edit,published}:{slug:string;period:string;type:SchedulePeriodType;anchor:string;why:boolean;edit:boolean;published:boolean}){
    return <section className="font-serif border rounded bg-amber-50 p-3 my-4 space-y-3" aria-label="Управление расписанием">
        <div className="flex flex-wrap gap-3 items-center">
            <Link className="border rounded bg-white px-4 py-2 text-red-900 font-bold" href={parishScheduleHref(slug,period,!edit,why)}>{edit?'Завершить редактирование':'Редактировать расписание'}</Link>
            <Link className="underline" href={`/parish/${slug}/rules`}>Постоянное расписание</Link>
            <Link className="underline" href={`/parish/${slug}/admins`}>Кто ведёт расписание</Link>
        </div>
        <PeriodSelector slug={slug} value={type} anchor={anchor} edit={edit} why={why}/>
        {edit&&<p className="text-sm text-slate-700">Режим редактирования: рядом с богослужением нажмите «Изменить время», а под нужным днём — «Добавить богослужение». Для регулярных изменений откройте «Постоянное расписание». {published?'После правок нажмите «Обновить опубликованный лист», чтобы прихожане увидели новую версию.':'Когда расписание будет готово, опубликуйте его кнопкой ниже.'}</p>}
    </section>;
}
