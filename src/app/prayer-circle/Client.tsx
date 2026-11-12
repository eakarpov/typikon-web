'use client';
import FootnoteScope, {FootnoteList} from '@/app/components/FootnoteScope';
import TextMarkup from '@/app/components/TextMarkup';
import { useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import Editor from './Editor';
import {containsReading} from '@/lib/prayerCircle/matching';
import {savePage,listSaved} from '@/lib/offline';
import { availablePresets,historyEntries,applyOperation,createState,initialConfig,ensureCycle,cycleAt,validateConfig,type Catalog,type CircleState,type Operation,type CircleConfig,type Part,type Row } from '@/lib/prayerCircle/core';
const button='border rounded px-3 py-2 min-h-11 disabled:opacity-50';
const labels:Record<Part,string>={evening:'Вечер',morning:'Утро',day:'В течение дня'};
interface Preview {commemorationSettings?:unknown;bookmarkMissing?:boolean;bookmark?:string|null;cycle:string;rows:Row[];readerSections?:{id:string;title:string}[];sections:{cursor?:number;block:{id:string;title:string;key:string;part:Part;kind:string;mode?:string};date:string;missing:string[];sources:string[];note?:string;changes:{label:string;citation:string}[]}[];complete:boolean;sources:Catalog['sources'];communion?:{date:string;days:number;sections:{id:string;title:string;rows:Row[];missing:string[];date?:string;part?:Part;due?:boolean}[]}}
interface Saved {state:CircleState;queue:Operation[]}
function safe<T>(key:string):T|null {try{return JSON.parse(localStorage.getItem(key)??'null');}catch{return null;}}
function PrayerText({row}:{row:Row}) {
    return <FootnoteScope content={row.text} footnotes={row.footnotes}>
        <div className="whitespace-pre-wrap"><TextMarkup text={row.text} footnotes={row.footnotes} markdown={row.markdown} /></div>
        <FootnoteList footnotes={row.footnotes} />
    </FootnoteScope>;
}
function matchingPreparation(preview:Preview,blockId:string) {
 const read=preview.rows.filter(r=>r.blockId===blockId);
 return preview.communion?.sections.filter(section=>!section.missing.length&&containsReading(read,section.rows))??[];
}

export default function Client() {
    const [previewRefresh,setPreviewRefresh]=useState(0);
    const [state,setState]=useState<CircleState|null>(null),[catalog,setCatalog]=useState<Catalog|null>(null),[preview,setPreview]=useState<Preview|null>(null);
    const [scope,setScope]=useState('guest'),[queue,setQueue]=useState<Operation[]>([]),[date,setDate]=useState(''),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[hasRemote,setHasRemote]=useState(false);
    const [offlineSaved,setOfflineSaved]=useState(false);
    const [shellSaved,setShellSaved]=useState(false);
    useEffect(()=>{void listSaved().then(a=>setShellSaved(a.ok&&a.saved.some(p=>p.url==='/prayer-circle')));},[]);
    const currentCycle=useRef('');const generation=useRef(0);const stateRef=useRef(state);stateRef.current=state;
    function persist(s:CircleState,q:Operation[],owner=scope) {localStorage.setItem('prayer-circle:'+owner,JSON.stringify({state:s,queue:q}));setState(s);setQueue(q);}
    async function load() {
        const gen=++generation.current;setBusy(true);setError('');setPreview(null);
        try {
            const r=await fetch('/api/v2/prayer-circle',{cache:'no-store'});
            let owner='guest',remote:CircleState|null=null;
            if(r.ok){const d=await r.json();owner='user:'+d.userId;remote=d.state;}else if(r.status!==401&&r.status!==403)throw Error('Не удалось загрузить круг.');
            if(gen!==generation.current)return;
            setScope(owner);sessionStorage.setItem('prayer-circle-owner',owner);localStorage.setItem('prayer-circle-offline-owner',owner);setHasRemote(!!remote);
            const saved=safe<Saved>('prayer-circle:'+owner);
            const s=saved?.queue.length?saved.state:remote??saved?.state??createState(initialConfig(Intl.DateTimeFormat().resolvedOptions().timeZone));
            const key=cycleAt(new Date(),s.config.timeZone);ensureCycle(s,key);currentCycle.current=key;setDate(key);setPreviewRefresh(n=>n+1);persist(s,saved?.queue??[],owner);
            if(saved?.queue.length)setMessage('Есть изменения на этом устройстве. Нажмите «Синхронизировать».');
        }catch(e) {
            if(gen!==generation.current)return;
            const owner=sessionStorage.getItem('prayer-circle-owner')??localStorage.getItem('prayer-circle-offline-owner')??'guest';const saved=safe<Saved>('prayer-circle:'+owner);
            if(saved){setScope(owner);setDate(cycleAt(new Date(),saved.state.config.timeZone));persist(saved.state,saved.queue,owner);setMessage('Открыта сохранённая копия.');}else setError(e instanceof Error?e.message:'Ошибка загрузки.');
        }finally{if(gen===generation.current)setBusy(false);}
    }
    useEffect(()=>{void load();fetch('/api/v2/prayer-circle/catalog').then(async r=>{if(!r.ok)throw Error();const c=await r.json();setCatalog(c);localStorage.setItem('prayer-circle:catalog',JSON.stringify(c));}).catch(()=>setCatalog(safe<Catalog>('prayer-circle:catalog')));const refresh=()=>void load();const ownerChanged=()=>{setState(null);setPreview(null);void load();};const storageChanged=(event:StorageEvent)=>{if(event.key==='prayer-circle-offline-owner')ownerChanged();};window.addEventListener('storage',storageChanged);window.addEventListener('focus',refresh);window.addEventListener('prayer-circle-owner-changed',ownerChanged);return()=>{generation.current++;window.removeEventListener('focus',refresh);window.removeEventListener('prayer-circle-owner-changed',ownerChanged);window.removeEventListener('storage',storageChanged);};},[]);
    const assemblyCycle=state&&date?ensureCycle(structuredClone(state),date):null;
    const assemblyKey=JSON.stringify([assemblyCycle?.config,assemblyCycle?.overrides,assemblyCycle?.cursors,date,scope,previewRefresh]);
    useEffect(()=>{
        if(!state||!date)return;let active=true;const cycle=ensureCycle(structuredClone(state),date);const cacheKey=`prayer-circle:${scope}:preview:${date}`;
        setPreview(null);setOfflineSaved(false);
        fetch('/api/v2/prayer-circle/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedUserId:scope==='guest'?null:scope.slice(5),config:cycle.config,cycle:date,progress:{marks:cycle.marks,counters:cycle.counters,cursors:cycle.cursors,overrides:cycle.overrides,bookmark:cycle.bookmark}})}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error?.message??d.error??'Не удалось собрать круг.');return d;}).then(p=>{if(active){setPreview(p);try{const old=safe<{config:CircleConfig;overrides:unknown;cursors:unknown;preview:Preview}>(cacheKey);if(p.complete||!old?.preview.complete||JSON.stringify([old.config,old.overrides,old.cursors,old.preview.commemorationSettings])!==JSON.stringify([cycle.config,cycle.overrides,cycle.cursors,p.commemorationSettings]))localStorage.setItem(cacheKey,JSON.stringify({config:cycle.config,overrides:cycle.overrides,cursors:cycle.cursors,preview:p}));setOfflineSaved(p.complete);}catch{setMessage('Не удалось сохранить тексты на устройстве. Освободите место для чтения без сети.');}}}).catch(e=>{if(!active)return;const saved=safe<{config:CircleConfig;overrides:unknown;cursors:unknown;preview:Preview}>(cacheKey);if(saved&&JSON.stringify(saved.config)===JSON.stringify(cycle.config)&&JSON.stringify(saved.overrides)===JSON.stringify(cycle.overrides)&&JSON.stringify(saved.cursors)===JSON.stringify(cycle.cursors)) {setPreview(saved.preview);setOfflineSaved(true);setMessage(saved.preview.complete?'Открыты сохранённые тексты последования.':'Сохранённая копия неполная.');}else setError(e.message);});
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
                const r=await fetch('/api/v2/prayer-circle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedUserId:scope.slice(5),config,cycle:date,cursors:(guest?.state??state).cursors,psalterCursor:(guest?.state??state).psalterCursor,progress:{marks:ensureCycle(structuredClone(guest?.state??state),date).marks,bookmark:ensureCycle(structuredClone(guest?.state??state),date).bookmark}})});const d=await r.json();if(!r.ok)throw Error(d.error?.message??'Не удалось сохранить круг.');if(gen!==generation.current||'user:'+d.userId!==scope)throw Error('Вход изменился. Откройте круг заново.');setHasRemote(true);persist(d.state,[],'user:'+d.userId);setScope('user:'+d.userId);
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
    {(['evening','morning','day'] as Part[]).map(part=><section className="space-y-2" key={part}><h2 className="text-xl font-bold">{labels[part]}</h2><label>Правило на эту часть дня <select className={button} value={cycle.overrides[part]??config.activeId} disabled={busy} onChange={e=>{const id=e.target.value;if(id.startsWith('template:')){const template=availablePresets(catalog!).find(t=>t.id===id.slice(9))!;void operation('override',{part,templateId:template.id,template});}else void operation('override',{part,variantId:id});}}><optgroup label="Мои варианты">{config.variants.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</optgroup><optgroup label="Готовые последования">{catalog&&availablePresets(catalog).map(t=><option key={t.id} value={'template:'+t.id}>{t.title}</option>)}</optgroup></select></label>
    {preview?.sections.filter(s=>s.block.part===part).map(s=><div className="border rounded p-3" key={s.block.id}><label><input type="checkbox" disabled={busy} checked={cycle.marks[s.block.id]??false} onChange={e=>void operation('mark',{blockId:s.block.id,done:e.target.checked,expectedCursor:s.cursor})}/> {s.block.title}</label> <a className="underline" href={'#row-'+s.block.id+':heading'}>Читать</a>
    {s.block.kind==='psalter'&&s.block.mode==='continuous'&&<button className={button} disabled={busy||!cycle.marks[s.block.id]} onClick={()=>void operation('next',{blockId:s.block.id,expectedCursor:s.cursor})}>Читать дальше в своём темпе</button>}
    {matchingPreparation(preview,s.block.id).map(p=><button className={button} key={'share:'+p.id} disabled={busy||!cycle.marks[s.block.id]} onClick={()=>void operation('communion-mark',{blockId:p.id,done:true})}>Учесть в подготовке: {p.title}</button>)}
    {s.missing.map((m,i)=><p key={i} role="status">{m}</p>)}{s.changes.map((ch,i)=><details key={i}><summary>{ch.label}</summary>{ch.citation}</details>)}
    {s.block.kind==='reading-plan'&&<Link className="underline" href="/reading-plan">Открыть план и перейти к следующему чтению</Link>}
    {s.note&&<p className="text-sm">{s.note}</p>}{s.sources.map(id=>{const src=preview.sources.find(s=>s.id===id);return src?<a className="block underline" key={id} href={src.url} target="_blank" rel="noreferrer">Источник: {src.title}</a>:null;})}</div>)}</section>)}
    {preview?.communion&&<section className="border rounded p-3 space-y-2"><h2 className="font-bold">Подготовка к Причащению · {preview.communion.date}</h2><p>Дней подготовки: {preview.communion.days}</p>{preview.communion.sections.map(s=><details key={s.id}><summary>{s.title}</summary>{s.missing.map(m=><p key={m}>{m}</p>)}<p>{s.date} · {labels[s.part??'day']}</p>{s.due?<a className="underline" href={'#row-communion:'+preview.communion!.date+':'+s.id+':heading'}>Читать в общем последовании</a>:<p>Откройте круг на назначенную дату для чтения.</p>}<label><input type="checkbox" checked={cycle.marks['communion:'+preview.communion!.date+':'+s.id]??false} onChange={e=>void operation('communion-mark',{blockId:s.id,done:e.target.checked})}/> Прочитано</label></details>)}</section>}
    {!preview?<p role="status">Собираю последование…</p>:<><p>{preview.complete?(offlineSaved&&shellSaved?'Полное последование сохранено для чтения без сети.':'Все тексты загружены. Для полного офлайн-доступа сохраните страницу.'):'Последование загружено не полностью — см. недостающие части выше.'}</p><button className={button} disabled={!preview.complete||!offlineSaved||busy} onClick={async()=>{const a=await savePage('/prayer-circle','Мой круг чтения и молитвы');setShellSaved(a.ok);if(!a.ok)setError(a.error);}}>Скачать для чтения без сети</button><p className="text-sm">Версия корпуса: {((preview as Preview&{corpusVersions?:string[]}).corpusVersions??[]).join(', ')||'не указана'}</p><nav aria-label="Оглавление" className="flex gap-3 flex-wrap">{(preview.readerSections??preview.sections.map(s=>({id:s.block.id,title:s.block.title}))).map(s=><a className="underline" key={s.id} href={'#row-'+s.id+':heading'}>{s.title}</a>)}</nav>{preview.bookmarkMissing&&<p>После изменения состава или текста сохранённое место недоступно. Выберите новое место в читателе.</p>}{(preview.bookmark??(!preview.bookmarkMissing?cycle.bookmark:null))&&<a className="underline block" href={'#row-'+(preview.bookmark??cycle.bookmark)}>Продолжить с сохранённого места</a>}
    <article style={{fontFamily:config.readerFont==='church'?'var(--cs-font, var(--font-monomakh)), serif':undefined}} className="font-serif text-lg leading-relaxed space-y-5">{preview.rows.map(row=><section id={'row-'+row.id} key={row.id} className="scroll-mt-4">{row.kind==='heading'?<h2 className="text-xl font-bold">{row.text}</h2>:<>{row.label&&<h3 className="font-bold">{row.label}</h3>}{row.note&&<p className="italic text-red-700 dark:text-red-400">{row.note}</p>}{row.kind==='rubric'?<div className="italic text-red-700 dark:text-red-400"><PrayerText row={row}/></div>:<PrayerText row={row}/>} {(row.repeatCount??1)>1&&<p className="text-sm">Повторить {row.repeatCount} раз{row.blockId&&preview.sections.some(s=>s.block.id===row.blockId&&['jesus','bogorodichnoe'].includes(s.block.key))&&<><button className={button} disabled={busy||(cycle.counters[row.blockId]??0)>=(row.repeatCount??1)} onClick={()=>void operation('counter',{blockId:row.blockId,count:(cycle.counters[row.blockId!]??0)+1})}>Счётчик: {cycle.counters[row.blockId]??0}</button><button className={button} onClick={()=>void operation('counter',{blockId:row.blockId,count:0})}>Сбросить счётчик</button></>}</p>}{row.poklon&&<p className="italic">{typeof row.poklon==='string'?row.poklon:'Поклон'}</p>}<button className="underline text-sm" disabled={busy} onClick={()=>void operation('bookmark',{rowId:row.id})}>Сохранить место</button></>}</section>)}</article></>}
    </>}
    {state&&<details><summary>История чтения</summary><p>Пропуски не переносятся на следующие дни. Отсутствие отметки не означает, что вы не молились.</p>{historyEntries(state).map(value=><div key={value.date}><h3>{value.date} · вечерняя дата круга</h3>{value.unopened?<p>Нет сохранённых отметок</p>:!value.blocks.length?<p>Чтения не назначены</p>:value.blocks.map(b=><p key={b.id}>{b.done?'✓':'Без отметки'} · {labels[b.part]} · {b.title}</p>)}</div>)}</details>}
    <details><summary>Источники и редакции</summary>{catalog?.sources.map(s=><p key={s.id}><a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a> · {s.role==='text'?'Текст':s.role==='order'?'Порядок совершения':'Исследование'}{s.scan?.transcription==='deferred_by_owner'?' · скан найден, распознавание отложено':s.status!=='verified'?' · требуется сверка':''}{s.edition&&' · редакция '+s.edition}{s.checkedAt&&' · проверено '+s.checkedAt}{s.locator&&' · '+s.locator}{s.purpose&&' · '+s.purpose}</p>)}</details>
    </section>;
}
