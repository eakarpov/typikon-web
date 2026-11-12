'use client';
import { useState } from 'react';
import type { PomyannikGroup } from '@/lib/pomyannik/groups';
const BUTTON='border rounded px-3 py-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-50';
export default function GroupTools({groups,selected,found,busy,onSelectAll,onClear,onCreate,onAssign}:{
    groups:PomyannikGroup[];selected:number;found:number;busy:boolean;
    onSelectAll:()=>void;onClear:()=>void;
    onCreate:(name:string)=>Promise<PomyannikGroup|null>;
    onAssign:(groupId:string)=>Promise<void>;
}){
    const [name,setName]=useState(''),[target,setTarget]=useState('');
    const create=async()=>{const group=await onCreate(name);if(group){setName('');setTarget(group.id);}};
    return <section id="pomyannik-groups" aria-label="Создание и наполнение групп" className="font-serif text-sm border rounded p-3 space-y-3 bg-slate-50">
        <h2 className="font-bold">Группы помянника</h2>
        <div className="flex gap-2 flex-wrap items-end">
            <label className="flex flex-col gap-1 min-w-0 flex-1">Новая группа
                <input maxLength={40} className="border rounded px-2 py-2 bg-white" value={name} disabled={busy} placeholder="Например: Семья" onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&name.trim()&&!busy){e.preventDefault();void create();}}}/>
            </label>
            <button type="button" className={BUTTON} disabled={busy||!name.trim()} onClick={()=>void create()}>Создать группу</button>
        </div>
        <p>Отфильтруйте список выше и отметьте нужные имена. Одна запись может входить в несколько групп.</p>
        <div className="flex flex-wrap gap-2 items-center">
            <button type="button" className={BUTTON} disabled={busy||!found} onClick={onSelectAll}>Выбрать найденные ({found})</button>
            <button type="button" className={BUTTON} disabled={busy||!selected} onClick={onClear}>Снять выбор</button>
            <span aria-live="polite">Выбрано: {selected}</span>
        </div>
        <p className="text-slate-500 text-xs">«Выбрать найденные» отмечает все результаты фильтра, включая другие страницы. При изменении фильтра выбор сбрасывается.</p>
        <div className="flex flex-wrap gap-2 items-end">
            <label className="flex flex-col gap-1 min-w-0 flex-1">Добавить выбранные в группу
                <select className="border rounded px-2 py-2 bg-white max-w-full" disabled={busy} value={target} onChange={e=>setTarget(e.target.value)}>
                    <option value="">Выберите группу</option>{groups.map(g=><option value={g.id} key={g.id}>{g.name}</option>)}
                </select>
            </label>
            <button type="button" className={BUTTON} disabled={busy||!selected||!target} onClick={()=>void onAssign(target)}>Добавить выбранные ({selected})</button>
        </div>
    </section>;
}
