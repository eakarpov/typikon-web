'use client';
import React from 'react';
import DirectGrant, {type Account} from './DirectGrant';
interface Priest {userId:string;title:string;diocese:string;place:string;accountName:string;accountEmail:string;accountExists:boolean;[key:string]:any}
const BUTTON='border rounded px-3 py-2 bg-slate-50 disabled:opacity-50';
export default function PriestList() {
    const [query,setQuery]=React.useState(''),[search,setSearch]=React.useState(''),[offset,setOffset]=React.useState(0);
    const [rows,setRows]=React.useState<Priest[]>([]),[total,setTotal]=React.useState(0),[busy,setBusy]=React.useState(true),[error,setError]=React.useState('');
    const [editing,setEditing]=React.useState<Account|null>(null),[revision,setRevision]=React.useState(0),[said,setSaid]=React.useState('');
    React.useEffect(()=>{let active=true;setBusy(true);setError('');
        fetch(`/api/admin/commemorators/priests?q=${encodeURIComponent(search)}&offset=${offset}&limit=50`)
            .then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error??'Не удалось загрузить список');return b;})
            .then(b=>{if(active){setRows(b.priests);setTotal(b.total);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});
        return ()=>{active=false;};
    },[search,offset,revision]);
    return <div className="flex flex-col gap-4 max-w-4xl font-serif">
        <h2 className="font-bold">Список иереев</h2>
        <form className="flex gap-2" onSubmit={e=>{e.preventDefault();setOffset(0);setSearch(query.trim());setRevision(n=>n+1);}}>
            <input aria-label="Поиск иерея" placeholder="Имя, епархия, храм или аккаунт" className="border rounded px-3 py-2 w-full" maxLength={200} value={query} onChange={e=>setQuery(e.target.value)}/>
            <button className={BUTTON}>Найти</button>
        </form>
        {said&&<p role="status">{said}</p>}
        {editing&&<section className="flex flex-col gap-2"><button className={BUTTON+' self-start'} onClick={()=>setEditing(null)}>Закрыть редактирование</button>
            <DirectGrant key={editing.id} initialAccount={editing} onSaved={()=>{setEditing(null);setSaid('Данные иерея сохранены.');setRevision(n=>n+1);}}/>
        </section>}
        {busy?<p role="status">Загрузка…</p>:error?<div role="alert">{error} <button className={BUTTON} onClick={()=>setRevision(n=>n+1)}>Повторить</button></div>:<>
            <p className="text-sm text-slate-600">Всего: {total}</p>
            {rows.length===0&&<p>Иереи не найдены.</p>}
            {rows.map(p=><article key={p.userId} className="border rounded p-4 flex flex-wrap justify-between gap-3">
                <div><h3 className="font-bold">{p.title}</h3><p>{p.diocese}{p.place&&` · ${p.place}`}</p>
                    <p className="text-sm text-slate-600">{p.accountName}{p.accountEmail&&` · ${p.accountEmail}`}</p>
                    <p className="text-xs text-slate-500">ID: {p.userId}</p>
                    {!p.accountExists&&<p className="text-sm">Аккаунт не найден. Редактирование недоступно.</p>}</div>
                <button className={BUTTON+' self-start'} disabled={!p.accountExists} onClick={()=>{setSaid('');setEditing({id:p.userId,name:p.accountName,email:p.accountEmail,priest:Object.fromEntries(['rank','name','title','diocese','dioceseUrl','place','about','donationDetails'].map(k=>[k,p[k]??'']))});}}>Редактировать</button>
            </article>)}
            <div className="flex items-center gap-3"><button className={BUTTON} disabled={offset===0} onClick={()=>setOffset(n=>Math.max(0,n-50))}>Назад</button>
                <span>{total?offset+1:0}–{Math.min(offset+50,total)} из {total}</span><button className={BUTTON} disabled={offset+50>=total} onClick={()=>setOffset(n=>n+50)}>Далее</button></div>
        </>}
    </div>;
}
