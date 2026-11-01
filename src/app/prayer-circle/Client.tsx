'use client';
import { useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import Editor from './Editor';
import { applyOperation,createState,initialConfig,ensureCycle,cycleAt,validateConfig,type Catalog,type CircleState,type Operation,type CircleConfig,type Part,type Row } from '@/lib/prayerCircle/core';
const button='border rounded px-3 py-2 min-h-11 disabled:opacity-50';
const labels:Record<Part,string>={evening:'Вечер',morning:'Утро',day:'В течение дня'};
interface Preview {cycle:string;rows:Row[];sections:{block:{id:string;title:string;key:string;part:Part;kind:string};date:string;missing:string[];sources:string[];changes:{label:string;citation:string}[]}[];complete:boolean;sources:Catalog['sources'];communion?:{date:string;days:number;sections:{id:string;title:string;rows:Row[];missing:string[]}[]}}
interface Saved {state:CircleState;queue:Operation[]}
function safe<T>(key:string):T|null {try{return JSON.parse(localStorage.getItem(key)??'null');}catch{return null;}}
function PrayerText({row}:{row:Row}) {
    if(row.markdown)return <ReactMarkdown>{row.text}</ReactMarkdown>;
    const pieces=row.text.split(/(\{k\|[^}]*\})/g);
    return <div className="whitespace-pre-wrap">{pieces.map((p,i)=>p.startsWith('{k|')?<span className="text-red-700 dark:text-red-400 italic" key={i}>{p.slice(3,-1)}</span>:<span key={i}>{p}</span>)}{row.footnotes?.length?<details><summary>Примечания</summary>{row.footnotes.map((n,i)=><p key={i}>{i+1}. {n}</p>)}</details>:null}</div>;
}
function matchingPreparation(preview:Preview,blockId:string) {
 const read=preview.rows.filter(r=>r.blockId===blockId&&r.kind!=='heading');
 return preview.communion?.sections.filter(section=>!section.missing.length&&section.rows.length&&section.rows.filter(r=>r.zone!=='opening'&&r.zone!=='closing').every(r=>read.some(row=>row.id===blockId+':'+r.id&&row.text===r.text&&(row.repeatCount??1)===(r.repeatCount??1))))??[];
}
export default function Client() {
    const [state,setState]=useState<CircleState|null>(null),[catalog,setCatalog]=useState<Catalog|null>(null),[preview,setPreview]=useState<Preview|null>(null);
    const [scope,setScope]=useState('guest'),[queue,setQueue]=useState<Operation[]>([]),[date,setDate]=useState(''),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[hasRemote,setHasRemote]=useState(false);
    const [offlineSaved,setOfflineSaved]=useState(false);
    const currentCycle=useRef('');const generation=useRef(0);const stateRef=useRef(state);stateRef.current=state;
    function persist(s:CircleState,q:Operation[],owner=scope) {localStorage.setItem('prayer-circle:'+owner,JSON.stringify({state:s,queue:q}));setState(s);setQueue(q);}
    async function load() {
        const gen=++generation.current;setBusy(true);setError('');setPreview(null);
        try {
            const r=await fetch('/api/v2/prayer-circle',{cache:'no-store'});
            let owner='guest',remote:CircleState|null=null;
            if(r.ok){const d=await r.json();owner='user:'+d.userId;remote=d.state;}else if(r.status!==401&&r.status!==403)throw Error('Не удалось загрузить круг.');
            if(gen!==generation.current)return;
            setScope(owner);sessionStorage.setItem('prayer-circle-owner',owner);setHasRemote(!!remote);
            const saved=safe<Saved>('prayer-circle:'+owner);
            const s=saved?.queue.length?saved.state:remote??saved?.state??createState(initialConfig(Intl.DateTimeFormat().resolvedOptions().timeZone));
            const key=cycleAt(new Date(),s.config.timeZone);ensureCycle(s,key);currentCycle.current=key;setDate(key);persist(s,saved?.queue??[],owner);
            if(saved?.queue.length)setMessage('Есть изменения на этом устройстве. Нажмите «Синхронизировать».');
        }catch(e) {
            if(gen!==generation.current)return;
            const owner=sessionStorage.getItem('prayer-circle-owner')??'guest';const saved=safe<Saved>('prayer-circle:'+owner);
            if(saved){setScope(owner);setDate(cycleAt(new Date(),saved.state.config.timeZone));persist(saved.state,saved.queue,owner);setMessage('Открыта сохранённая копия.');}else setError(e instanceof Error?e.message:'Ошибка загрузки.');
        }finally{if(gen===generation.current)setBusy(false);}
    }
    useEffect(()=>{void load();fetch('/api/v2/prayer-circle/catalog').then(async r=>{if(!r.ok)throw Error();const c=await r.json();setCatalog(c);localStorage.setItem('prayer-circle:catalog',JSON.stringify(c));}).catch(()=>setCatalog(safe<Catalog>('prayer-circle:catalog')));const refresh=()=>void load();const ownerChanged=()=>{setState(null);setPreview(null);void load();};window.addEventListener('focus',refresh);window.addEventListener('prayer-circle-owner-changed',ownerChanged);return()=>{generation.current++;window.removeEventListener('focus',refresh);window.removeEventListener('prayer-circle-owner-changed',ownerChanged);};},[]);
    const assemblyCycle=state&&date?ensureCycle(structuredClone(state),date):null;
    const assemblyKey=JSON.stringify([assemblyCycle?.config,assemblyCycle?.overrides,assemblyCycle?.cursors,date,scope]);
    useEffect(()=>{
        if(!state||!date)return;let active=true;const cycle=ensureCycle(structuredClone(state),date);const cacheKey=`prayer-circle:${scope}:preview:${date}`;
        setPreview(null);setOfflineSaved(false);
        fetch('/api/v2/prayer-circle/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedUserId:scope==='guest'?null:scope.slice(5),config:cycle.config,cycle:date,progress:{marks:cycle.marks,counters:cycle.counters,cursors:cycle.cursors,overrides:cycle.overrides,bookmark:cycle.bookmark}})}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error?.message??d.error??'Не удалось собрать круг.');return d;}).then(p=>{if(active){setPreview(p);try{localStorage.setItem(cacheKey,JSON.stringify({config:cycle.config,overrides:cycle.overrides,cursors:cycle.cursors,preview:p}));setOfflineSaved(true);}catch{setMessage('Не удалось сохранить тексты на устройстве. Освободите место для чтения без сети.');}}}).catch(e=>{if(!active)return;const saved=safe<{config:CircleConfig;overrides:unknown;cursors:unknown;preview:Preview}>(cacheKey);if(saved&&JSON.stringify(saved.config)===JSON.stringify(cycle.config)&&JSON.stringify(saved.overrides)===JSON.stringify(cycle.overrides)&&JSON.stringify(saved.cursors)===JSON.stringify(cycle.cursors)) {setPreview(saved.preview);setOfflineSaved(true);setMessage(saved.preview.complete?'Сохранённое последование доступно без сети.':'Сохранённая копия неполная.');}else setError(e.message);});
        return()=>{active=false;};
    },[assemblyKey]);
    // Check the local 15:00 boundary while open and when returning from sleep.
    useEffect(()=>{const t=setInterval(()=>{const s=stateRef.current;if(!s)return;const key=cycleAt(new Date(),s.config.timeZone);if(currentCycle.current&&key!==currentCycle.current){const previous=currentCycle.current;currentCycle.current=key;setDate(d=>d===previous?key:d);}},30000);return()=>clearInterval(t);},[]);
    async function sync(q=queue,s=state) {
        if(!s||scope==='guest'||!q.length)return;const gen=generation.current;setBusy(true);setError('');
        try {
            const r=await fetch('/api/v2/prayer-circle',{cache:'no-store'});const d=await r.json();if(!r.ok||'user:'+d.userId!==scope)throw Error('Вход изменился. Обновите страницу.');
            let remote:CircleState=d.state;if(!remote)throw Error('Сначала сохраните круг в аккаунте.');
            for(const op of q) {
                if(gen!==generation.current)throw Error('Вход изменился. Откройте круг заново.');
                if(remote.receipts.includes(op.id))continue;
                if(op.revision!==remote.revision)throw Error('Круг изменился на другом устройстве. Местная копия сохранена. Можно загрузить аккаунт или сохранить местный состав отдельным вариантом.');
                const res=await fetch('/api/v2/prayer-circle',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...op,expectedUserId:scope.slice(5)})});const body=await res.json();if(!res.ok)throw Error(body.error?.message??body.error??'Не удалось синхронизировать.');if(gen!==generation.current||'user:'+body.userId!==scope)throw Error('Вход изменился. Откройте круг заново.');remote=body.state;
            }
            persist(remote,[]);setMessage('Изменения синхронизированы.');
        }catch(e){setError(e instanceof Error?e.message:'Не удалось синхронизировать.');}finally{setBusy(false);}
    }
    async function operation(action:Operation['action'],values:Record<string,unknown>) {
        if(!state||busy)return;setError('');
        try {const op:Operation={id:crypto.randomUUID(),revision:state.revision,cycle:date,action,...values};const next=applyOperation(state,op);const q=scope==='guest'?[]:[...queue,op];persist(next,q);if(scope!=='guest'&&hasRemote)await sync(q,next);}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить.');}
    }
    async function saveAccount() {
        if(!state)return;const gen=generation.current;setBusy(true);setError('');try {
            const guest=safe<Saved>('prayer-circle:guest');const config=guest?.state.config??state.config;
            if(hasRemote) {
                const imported=config.variants.map(v=>({...v,id:crypto.randomUUID(),title:v.title+' (с устройства)',blocks:v.blocks.map(b=>({...b,id:crypto.randomUUID()}))}));
                const c={...state.config,variants:[...state.config.variants,...imported]};validateConfig(c);
                const op:Operation={id:crypto.randomUUID(),revision:state.revision,cycle:date,action:'config',config:c,applyToday:true};
                const r=await fetch('/api/v2/prayer-circle',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...op,expectedUserId:scope.slice(5)})});const d=await r.json();if(!r.ok)throw Error(d.error?.message??'Не удалось перенести варианты.');if(gen!==generation.current||'user:'+d.userId!==scope)throw Error('Вход изменился. Откройте круг заново.');persist(d.state,[]);
            }else {
                const r=await fetch('/api/v2/prayer-circle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedUserId:scope.slice(5),config,cycle:date,cursors:(guest?.state??state).cursors,progress:{marks:ensureCycle(structuredClone(guest?.state??state),date).marks,bookmark:ensureCycle(structuredClone(guest?.state??state),date).bookmark}})});const d=await r.json();if(!r.ok)throw Error(d.error?.message??'Не удалось сохранить круг.');if(gen!==generation.current||'user:'+d.userId!==scope)throw Error('Вход изменился. Откройте круг заново.');setHasRemote(true);persist(d.state,[],'user:'+d.userId);setScope('user:'+d.userId);
            }
        }catch(e){setError(e instanceof Error?e.message:'Ошибка переноса.');}finally{setBusy(false);}
    }
    if(!state)return <section aria-live="polite"><p>{error||'Загружаю круг…'}</p><button className={button} onClick={()=>void load()}>Повторить</button></section>;
    const cycle=ensureCycle(structuredClone(state),date);const config=cycle.config;
    return <section className="space-y-5 max-w-3xl">
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    <div className="flex gap-2 flex-wrap"><button className={button} disabled={busy||!catalog} onClick={()=>setEditing(!editing)}>Изменить состав</button><button className={button} disabled={busy} onClick={()=>void load()}>Загрузить аккаунт</button>{queue.length>0&&<button className={button} disabled={busy} onClick={()=>void sync()}>Синхронизировать ({queue.length})</button>}</div>
    {scope==='guest'?<p>Круг сохраняется на этом устройстве. <Link href="/login" className="underline">Войти</Link> для синхронизации.</p>:<button className={button} disabled={busy||!!queue.length} onClick={()=>void saveAccount()}>{hasRemote?'Добавить варианты с устройства':'Сохранить круг в аккаунте'}</button>}
    {state.pending&&<p>Новый состав начнёт действовать с вечера {state.pending.effectiveCycle}.</p>}
    {editing&&catalog?<Editor key={state.revision} value={state.pending?.config??state.config} catalog={catalog} onCancel={()=>setEditing(false)} onSave={(c,today)=>{try{validateConfig(c);void operation('config',{config:c,applyToday:today});setEditing(false);}catch(e){setError((e as Error).message);}}}/>:<>
    <label className="block">Вечерняя дата круга <input className={button} type="date" min="1900-01-01" max="2099-12-30" value={date} onChange={e=>e.target.value&&setDate(e.target.value)}/></label>
    <p>Круг начинается в 15:00: вечер выбранного дня, затем утро и день следующего.</p>
    {(['evening','morning','day'] as Part[]).map(part=><section className="space-y-2" key={part}><h2 className="text-xl font-bold">{labels[part]}</h2><label>Правило на эту часть дня <select className={button} value={cycle.overrides[part]??config.activeId} disabled={busy} onChange={e=>void operation('override',{part,variantId:e.target.value})}>{config.variants.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>
    {preview?.sections.filter(s=>s.block.part===part).map(s=><div className="border rounded p-3" key={s.block.id}><label><input type="checkbox" disabled={busy} checked={cycle.marks[s.block.id]??false} onChange={e=>void operation('mark',{blockId:s.block.id,done:e.target.checked})}/> {s.block.title}</label> <a className="underline" href={'#row-'+s.block.id+':heading'}>Читать</a>
    {matchingPreparation(preview,s.block.id).map(p=><button className={button} key={'share:'+p.id} disabled={busy||!cycle.marks[s.block.id]} onClick={()=>void operation('communion-mark',{blockId:p.id,done:true})}>Учесть в подготовке: {p.title}</button>)}
    {s.missing.map((m,i)=><p key={i} role="status">{m}</p>)}{s.changes.map((ch,i)=><details key={i}><summary>{ch.label}</summary>{ch.citation}</details>)}
    {s.block.kind==='reading-plan'&&<Link className="underline" href="/reading-plan">Открыть план и перейти к следующему чтению</Link>}
    {s.sources.map(id=>{const src=preview.sources.find(s=>s.id===id);return src?<a className="block underline" key={id} href={src.url} target="_blank" rel="noreferrer">Источник: {src.title}</a>:null;})}</div>)}</section>)}
    {preview?.communion&&<section className="border rounded p-3 space-y-2"><h2 className="font-bold">Подготовка к Причащению · {preview.communion.date}</h2><p>Дней подготовки: {preview.communion.days}</p>{preview.communion.sections.map(s=><details key={s.id}><summary>{s.title}</summary>{s.missing.map(m=><p key={m}>{m}</p>)}{s.rows.map(r=><PrayerText key={r.id} row={r}/>)}<label><input type="checkbox" checked={cycle.marks['communion:'+preview.communion!.date+':'+s.id]??false} onChange={e=>void operation('communion-mark',{blockId:s.id,done:e.target.checked})}/> Прочитано</label></details>)}</section>}
    {!preview?<p role="status">Собираю последование…</p>:<><p>{preview.complete?(offlineSaved?'Все тексты загружены. Копия сохранена для чтения без сети.':'Все тексты загружены. Офлайн-копия не сохранена.'):'Последование загружено не полностью — см. недостающие части выше.'}</p><nav aria-label="Оглавление" className="flex gap-3 flex-wrap">{preview.sections.map(s=><a className="underline" key={s.block.id} href={'#row-'+s.block.id+':heading'}>{s.block.title}</a>)}</nav>{cycle.bookmark&&<a className="underline block" href={'#row-'+cycle.bookmark}>Продолжить с сохранённого места</a>}
    <article className="font-serif text-lg leading-relaxed space-y-5">{preview.rows.map(row=><section id={'row-'+row.id} key={row.id} className="scroll-mt-4">{row.kind==='heading'?<h2 className="text-xl font-bold">{row.text}</h2>:<>{row.label&&<h3 className="font-bold">{row.label}</h3>}{row.note&&<p className="italic text-red-700 dark:text-red-400">{row.note}</p>}{row.kind==='rubric'?<p className="italic text-red-700 dark:text-red-400">{row.text}</p>:<PrayerText row={row}/>} {(row.repeatCount??1)>1&&<p className="text-sm">Повторить {row.repeatCount} раз{row.blockId&&preview.sections.some(s=>s.block.id===row.blockId&&['jesus','bogorodichnoe'].includes(s.block.key))&&<><button className={button} disabled={busy||(cycle.counters[row.blockId]??0)>=(row.repeatCount??1)} onClick={()=>void operation('counter',{blockId:row.blockId,count:(cycle.counters[row.blockId!]??0)+1})}>Счётчик: {cycle.counters[row.blockId]??0}</button><button className={button} onClick={()=>void operation('counter',{blockId:row.blockId,count:0})}>Сбросить счётчик</button></>}</p>}{row.poklon&&<p className="italic">{typeof row.poklon==='string'?row.poklon:'Поклон'}</p>}<button className="underline text-sm" disabled={busy} onClick={()=>void operation('bookmark',{rowId:row.id})}>Сохранить место</button></>}</section>)}</article></>}
    </>}
    <details><summary>Источники и редакции</summary>{catalog?.sources.map(s=><p key={s.id}><a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a> · {s.role==='text'?'Текст':s.role==='order'?'Порядок совершения':'Исследование'}{s.status!=='verified'?' · требуется сверка':''}{s.locator&&' · '+s.locator}</p>)}</details>
    </section>;
}
