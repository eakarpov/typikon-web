'use client';
import {useEffect,useState} from 'react';
const btn='border rounded px-3 py-2 min-h-11 disabled:opacity-50';
export default function NoteSharing({id,onChanged}:{id:string;onChanged?:()=>void}){
  const [state,setState]=useState<{userId:string;revision:number;noteRevision:number;published:boolean;shareToken:string|null;preview?:{text:string;quote:string}}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[open,setOpen]=useState(false);
  useEffect(()=>{if(!open)return;let active=true;const changed=()=>{active=false;setState(null);setOpen(false);};window.addEventListener('companion-owner-changed',changed);fetch('/api/v2/notes/sharing?'+new URLSearchParams({id}),{cache:'no-store'}).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error?.message??'Не удалось получить настройки.');if(active)setState(b);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;window.removeEventListener('companion-owner-changed',changed);};},[id,open]);
  async function toggle(){
    if(!state||busy)return;
    if(!state.published&&!window.confirm('Открыть доступ по ссылке к этой заметке и выделенному фрагменту? Любой получатель ссылки сможет их прочитать.'))return;
    setBusy(true);setError('');
    try{const r=await fetch('/api/v2/notes/sharing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,expectedUserId:state.userId,expectedRevision:state.revision,expectedNoteRevision:state.noteRevision,published:!state.published})}),b=await r.json();if(!r.ok)throw Error(b.error?.message??'Не удалось изменить доступ.');setState({...state,...b});onChanged?.();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const link=state?.shareToken?location.origin+'/notes/shared/'+state.shareToken:'';
  return <div className="space-y-2"><button className={btn} onClick={()=>{setState(null);setError('');setOpen(!open);}}>Доступ к заметке</button>{open&&<>
    {state?.preview&&<div className="border rounded p-3 whitespace-pre-wrap"><p>Сохранённая версия заметки:</p><blockquote>{state.preview.quote}</blockquote><p>{state.preview.text}</p></div>}
    <p>{state?(state.published?'Доступна по ссылке. Изменения текста заметки также видны получателям ссылки.':'Приватная. Видна только вам.'):'Загружаю настройки…'}</p>
    <button className={btn} disabled={!state||busy} onClick={()=>void toggle()}>{state?.published?'Отключить доступ по ссылке':'Опубликовать по ссылке'}</button>
    {link&&<><input aria-label="Ссылка на заметку" readOnly className="border rounded w-full p-2" value={link} onFocus={e=>e.target.select()}/><button className={btn} onClick={()=>void navigator.clipboard.writeText(link).catch(()=>setError('Скопируйте ссылку из поля.'))}>Скопировать ссылку</button></>}
    {error&&<p role="alert">{error}</p>}
  </>}</div>;
}
