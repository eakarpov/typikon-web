'use client';
import React from 'react';
import { PRIEST_RANKS } from '@/lib/pomyannik/directGrantRules';
const FIELD='border rounded px-3 py-2 bg-white w-full';
const BUTTON='border rounded px-3 py-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-50';
export interface Account { id: string; name: string; email: string; priest: Record<string,string> | null }
interface Pending { _id: string; email: string; details: { title: string; diocese: string }; reason: string }
const empty={rank:'ierey',name:'',diocese:'',dioceseUrl:'',place:'',about:'',donationDetails:'',reason:''};
const formFor = (user: Account) => {
    const p = user.priest;
    if (!p) return {...empty, name:user.name};
    const rank = p.rank || Object.entries(PRIEST_RANKS).find(([,label]) => p.title?.toLowerCase().startsWith(label.toLowerCase()+' '))?.[0] || 'ierey';
    const name = p.name || p.title?.replace(new RegExp('^('+Object.values(PRIEST_RANKS).join('|')+')\\s+','i'),'') || user.name;
    return {...empty,...p,name,rank,reason:'Редактирование данных иерея'};
};
export default function DirectGrant({initialAccount, onSaved}: {initialAccount?: Account; onSaved?: () => void}) {
    const [targetType,setTargetType]=React.useState('user');
    const [query,setQuery]=React.useState('');const [users,setUsers]=React.useState<Account[]>([]);
    const [selected,setSelected]=React.useState<Account|null>(initialAccount ?? null);const [email,setEmail]=React.useState('');
    const [form,setForm]=React.useState(initialAccount ? formFor(initialAccount) : empty);const [pending,setPending]=React.useState<Pending[]>([]);
    const [busy,setBusy]=React.useState(false);const [said,setSaid]=React.useState('');
    const refresh = React.useCallback(async(q='')=>{
        const r=await fetch('/api/admin/commemorators/direct?q='+encodeURIComponent(q));
        const body=await r.json();if(!r.ok)throw Error(body?.error??'Не удалось найти аккаунт');
        setUsers(body.users);setPending(body.grants);
    },[]);
    React.useEffect(()=>{if (!initialAccount) refresh().catch(e=>setSaid(e.message));},[refresh,initialAccount]);
    const choose=(user:Account)=>{
        setSelected(user);setSaid('');
        setForm(formFor(user));
    };
    const search=async()=>{setBusy(true);setSaid('');try{await refresh(query);}catch(e){setSaid((e as Error).message);}finally{setBusy(false);}};
    const save=async(e:React.FormEvent)=>{
        e.preventDefault();if(targetType==='user'&&!selected){setSaid('Найдите и выберите аккаунт');return;}
        setBusy(true);setSaid('');
        try{
            const editing=!!selected?.priest&&targetType==='user';
            const r=await fetch(editing?'/api/admin/commemorators/priests':'/api/admin/commemorators/direct',{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json'},
                body:JSON.stringify({...form,targetType,userId:selected?.id,email})});
            const body=await r.json();if(!r.ok)throw Error(body?.error??'Не удалось назначить доступ');
            if(editing){setSaid('Данные иерея сохранены.');onSaved?.();} else setSaid(body.status==='bound'?'Доступ назначен. Кабинет появится после обычного входа в этот аккаунт.':
                'Назначение сохранено. Кабинет появится при входе через Google с указанной подтверждённой почтой.');
            if(!initialAccount) await refresh(query);
        }catch(e){setSaid((e as Error).message);}finally{setBusy(false);}
    };
    const revoke=async(email:string)=>{
        setBusy(true);setSaid('');try{
            const r=await fetch('/api/admin/commemorators/direct',{method:'POST',headers:{'Content-Type':'application/json'},
                body:JSON.stringify({action:'revoke-pending',email})});
            const body=await r.json();if(!r.ok)throw Error(body.error??'Не удалось отменить');await refresh(query);
        }catch(e){setSaid((e as Error).message);}finally{setBusy(false);}
    };
    return <section className="border rounded p-4 max-w-3xl font-serif flex flex-col gap-4">
        <h2 className="font-bold">{initialAccount?'Редактировать данные иерея':'Создать заявку вручную'}</h2>
        {!initialAccount&&<><p className="text-sm text-slate-600">Для знакомого священника: администратор подтверждает доступ самостоятельно. Письма и заявка не нужны. Приём записок и службы иерей настроит сам.</p>
        <div className="flex flex-wrap gap-4">
            <label><input type="radio" checked={targetType==='user'} onChange={()=>setTargetType('user')} disabled={busy}/> Существующий аккаунт</label>
            <label><input type="radio" checked={targetType==='email'} onChange={()=>setTargetType('email')} disabled={busy}/> До первого входа, по почте Google</label>
        </div>
        {targetType==='user'&&<div className="flex flex-col gap-2">
            <label>Найти аккаунт по имени, почте профиля или ID
                <div className="flex gap-2 mt-1"><input className={FIELD} value={query} onChange={e=>{setQuery(e.target.value);setSelected(null);}} disabled={busy}/>
                    <button type="button" className={BUTTON} onClick={search} disabled={busy||query.trim().length<2}>Найти</button></div>
            </label>
            {users.map(user=><label key={user.id} className="border rounded p-2 text-sm flex gap-2 items-start">
                <input type="radio" name="target-user" checked={selected?.id===user.id} onChange={()=>choose(user)} disabled={busy}/>
                <span>{user.name||'Имя не заполнено'}{user.email&&` · ${user.email}`}<span className="block text-slate-500">ID: {user.id}{user.priest&&` · ${user.priest.title}`}</span></span>
            </label>)}
            {selected&&<p className="text-sm">Выбран аккаунт: <strong>{selected.name||selected.email||selected.id}</strong></p>}
        </div>}
        </>}
        <form onSubmit={save} className="flex flex-col gap-3">
            {targetType==='email'&&<label>Почта аккаунта Google<input className={FIELD} type="email" required maxLength={254} value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/>
                <span className="block text-xs text-slate-500">Можно указать до регистрации. Доступ привяжется только при входе с почтой, подтверждённой Google.</span></label>}
            <label>Сан<select className={FIELD} value={form.rank} disabled={busy} onChange={e=>setForm(f=>({...f,rank:e.target.value}))}>
                {Object.entries(PRIEST_RANKS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
            {(['name','diocese','dioceseUrl','place','donationDetails'] as const).map(key=><label key={key}>
                {{name:'Имя и фамилия',diocese:'Епархия',dioceseUrl:'Страница епархии · необязательно',place:'Храм / место служения · необязательно',donationDetails:'Реквизиты для пожертвований · необязательно'}[key]}
                <input className={FIELD} value={form[key]} required={key==='name'||key==='diocese'} type={key==='dioceseUrl'?'url':'text'}
                    maxLength={{name:120,diocese:200,dioceseUrl:300,place:200,donationDetails:1000}[key]} disabled={busy} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/>
            </label>)}
            <label>О священнике · необязательно<textarea className={FIELD} maxLength={1000} rows={2} value={form.about} disabled={busy} onChange={e=>setForm(f=>({...f,about:e.target.value}))}/></label>
            <label>{selected?.priest?'Основание изменения':'Основание назначения'}<textarea className={FIELD} required maxLength={1000} rows={2} placeholder="Например: лично знаком со священником" value={form.reason} disabled={busy} onChange={e=>setForm(f=>({...f,reason:e.target.value}))}/>
                <span className="block text-xs text-slate-500">Сохраняется вместе с именем администратора и датой. Пользователю не отправляется.</span></label>
            <button className={BUTTON+' self-start'} disabled={busy}>{busy?'Сохраняем…':selected?.priest&&targetType==='user'?'Сохранить данные иерея':'Назначить доступ иерея'}</button>
        </form>
        {said&&<p role="status" className="text-sm whitespace-pre-wrap">{said}</p>}
        {pending.length>0&&<div><h3 className="font-bold">Ожидают входа через Google</h3>
            {pending.map(g=><div key={g._id} className="border-t py-2 text-sm flex justify-between gap-3"><span>{g.details.title} · {g.details.diocese}<br/>{g.email}</span>
                <button className={BUTTON} disabled={busy} onClick={()=>revoke(g.email)}>Отменить назначение</button></div>)}
        </div>}
    </section>;
}
