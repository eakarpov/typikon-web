'use client';
import { useState, type FormEvent } from 'react';
import type { WeeklyPolicy } from '@/lib/pomyannik/weeklyQuota';
const days = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
export default function Form({initial}:{initial: WeeklyPolicy}) {
    const [policy, setPolicy] = useState(initial), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
    async function save(e: FormEvent) {
        e.preventDefault(); setBusy(true); setMessage('');
        try {
            const response = await fetch('/api/admin/note-limits', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(policy)});
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Не удалось сохранить');
            setPolicy(data); setMessage('Сохранено');
        } catch(e) { setMessage(e instanceof Error ? e.message : 'Не удалось сохранить'); }
        finally { setBusy(false); }
    }
    return <form onSubmit={save} className="p-4 flex flex-col gap-4 max-w-xl">
        <h1>Лимит подачи имён в записках</h1>
        <p>Общий недельный лимит на пользователя для всех видов записок и получателей. Повторная подача того же имени тоже расходует лимит. Изменения применяются сразу; история подач сохраняется.</p>
        <label>Имён в неделю <input type="number" min={1} max={100000} required value={policy.namesLimit} onChange={e=>setPolicy({...policy,namesLimit:Number(e.target.value)})}/></label>
        <label>День сброса <select value={policy.resetDay} onChange={e=>setPolicy({...policy,resetDay:Number(e.target.value)})}>{days.map((day,i)=><option key={day} value={i+1}>{day}</option>)}</select></label>
        <label>Время сброса (Москва) <input type="time" required value={`${String(policy.resetHour).padStart(2,'0')}:${String(policy.resetMinute).padStart(2,'0')}`} onChange={e=>{const [resetHour,resetMinute]=e.target.value.split(':').map(Number);setPolicy({...policy,resetHour,resetMinute});}}/></label>
        <button disabled={busy} type="submit">{busy?'Сохраняем…':'Сохранить'}</button><p role="status">{message}</p>
    </form>;
}
