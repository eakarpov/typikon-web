'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {parishScheduleHref,periodKeyForDate,type SchedulePeriodType} from '@/lib/parish/period';
export default function PeriodSelector({slug,value,anchor,edit,why}:{slug:string;value:SchedulePeriodType;anchor:string;edit:boolean;why:boolean}){
    const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState('');
    const change=async(period:SchedulePeriodType)=>{
        setBusy(true);setError('');
        try{
            const response=await fetch(`/api/parish/${slug}/settings`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schedulePeriod:period})});
            if(!response.ok){const data=await response.json().catch(()=>null);throw Error(data?.error??'Не удалось сохранить формат расписания.');}
            router.push(parishScheduleHref(slug,periodKeyForDate(anchor,period),edit,why));
        }catch(e){setError((e as Error).message);}finally{setBusy(false);}
    };
    return <div className="font-serif text-sm space-y-1"><label className="flex flex-wrap items-center gap-2">Формат расписания
        <select className="border rounded px-3 py-2 bg-white" value={value} disabled={busy} onChange={e=>void change(e.target.value as SchedulePeriodType)}><option value="month">На месяц</option><option value="week">На неделю</option></select>
        <span className="text-slate-500">Сохраняется для этого храма</span>
    </label>{error&&<p role="alert" className="text-red-800">{error}</p>}</div>;
}
