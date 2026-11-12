'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { COMMEMORATION_PLACES, COMMEMORATION_LABELS, defaultCommemorations, type CommemorationSettings as Settings, type CommemorationPlace, type CommemorationSelection } from '@/lib/pomyannik/commemoration';
interface Group { id:string; name:string; living:number; departed:number }
const valueOf = (place:CommemorationPlace,choice:CommemorationSelection) => choice.mode === 'group' ? `group:${choice.for??(place==='morning-living'?'living':place==='morning-departed'?'departed':'both')}:${choice.group}` : choice.mode;
export default function CommemorationSettings() {
    const [settings,setSettings] = useState(defaultCommemorations);
    const [groups,setGroups] = useState<Group[]>([]);
    const [busy,setBusy] = useState(true),[signedIn,setSignedIn] = useState(false),[error,setError] = useState(''),[message,setMessage] = useState('');
    const load = async () => {
        setBusy(true); setError('');
        try {
            const response = await fetch('/api/pomyannik/commemoration',{cache:'no-store'});
            if(response.status === 401) {setSignedIn(false);return;}
            if(!response.ok) throw Error('Не удалось загрузить настройки поминовения.');
            const body = await response.json(); setSignedIn(true); setSettings(body.settings); setGroups(body.groups);
        } catch(e) {setError(e instanceof Error?e.message:'Не удалось загрузить настройки.');}
        finally {setBusy(false);}
    };
    useEffect(()=>{void load();},[]);
    const save = async () => {
        setBusy(true);setError('');setMessage('');
        try {
            const response = await fetch('/api/pomyannik/commemoration',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({settings})});
            const body = await response.json().catch(()=>null);
            if(!response.ok) throw Error(body?.error??'Не удалось сохранить настройки.');
            setSettings(body.settings as Settings);setMessage('Настройки сохранены в аккаунте.');
            window.dispatchEvent(new Event('pomyannik-commemoration-changed'));
        } catch(e) {setError(e instanceof Error?e.message:'Не удалось сохранить настройки. Проверьте сеть.');}
        finally {setBusy(false);}
    };
    const select = (place:CommemorationPlace,value:string) => {
        const split=value.indexOf(':',6);
        const choice:CommemorationSelection = value.startsWith('group:') ? {mode:'group',for:value.slice(6,split) as 'living'|'departed'|'both',group:value.slice(split+1)} : {mode:value as CommemorationSelection['mode']};
        setSettings(current=>({...current,[place]:choice}));setMessage('');
    };
    return <section className="font-serif mt-6 space-y-3 max-w-2xl" aria-labelledby="commemoration-title">
        <h2 id="commemoration-title" className="font-bold text-lg">Имена в молитвенных чтениях</h2>
        <p className="text-sm text-slate-600">Каждое место настраивается независимо. Выбор сохраняется в аккаунте для сайта и приложения. Для группы можно выбрать имена о здравии, о упокоении или оба раздела. В утренней молитве берутся только имена соответствующего раздела.</p>
        <fieldset disabled={busy || !signedIn} className="space-y-3 min-w-0">
            {COMMEMORATION_PLACES.map(place=>{
                const choice=settings[place];
                const groupOptions=groups.flatMap(group=>[
                    ...(place!=='morning-departed'?[{value:`group:living:${group.id}`,label:`Группа «${group.name}» — о здравии (${group.living})`}]:[]),
                    ...(place!=='morning-living'?[{value:`group:departed:${group.id}`,label:`Группа «${group.name}» — о упокоении (${group.departed})`}]:[]),
                    ...(place.startsWith('psalter-')?[{value:`group:both:${group.id}`,label:`Группа «${group.name}» — все имена (${group.living+group.departed})`}]:[]),
                ]);
                const selectedValue=valueOf(place,choice);
                return <label key={place} className="flex flex-col gap-1 text-sm">{COMMEMORATION_LABELS[place]}
                    <select className="border rounded px-2 py-2 bg-white max-w-full" value={selectedValue} onChange={e=>select(place,e.target.value)}>
                        <option value="none">Без поимённого поминовения</option>
                        {place!=='morning-departed' && <option value="living">Все имена о здравии</option>}
                        {place!=='morning-living' && <option value="departed">Все имена о упокоении</option>}
                        {groupOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
                        {choice.mode==='group'&&!groupOptions.some(option=>option.value===selectedValue)&&<option value={selectedValue}>Группа больше не найдена</option>}
                    </select>
                </label>;
            })}
        </fieldset>
        {!busy&&!signedIn&&!error&&<p className="text-sm"><Link href="/login" className="underline">Войдите</Link>, чтобы выбрать группы своего помянника и сохранить настройки.</p>}
        {signedIn&&<button type="button" className="border rounded px-3 py-2 text-sm disabled:opacity-50" disabled={busy} onClick={save}>Сохранить поминовение</button>}
        {busy&&<p role="status" className="text-sm">Загружаем настройки…</p>}
        {error&&<p role="alert" className="text-amber-800">{error} <button className="underline" onClick={()=>void load()}>Повторить загрузку</button></p>}
        {message&&<p role="status" className="text-sm">{message}</p>}
    </section>;
}
