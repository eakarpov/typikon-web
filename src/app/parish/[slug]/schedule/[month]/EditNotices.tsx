import type {AppliedEdit} from '@/lib/parish/editModel';
import {DropEdit} from './Edit';
/** Служебные расхождения остаются на сервере и видны только редактору храма. */
export default function EditNotices({canEdit,slug,stale,orphaned}:{canEdit:boolean;slug:string;stale:AppliedEdit[];orphaned:AppliedEdit[]}){
 if(!canEdit||(!stale.length&&!orphaned.length))return null;
 return <div style={{margin:'.75rem 0 0',padding:'.5rem .75rem',background:'#fdf6e3',fontSize:'.85rem'}}>
 {stale.map(e=><div key={e._id} style={{marginBottom:'.3rem'}}><b>{Number(e.date.slice(8))} числа</b> устав теперь предлагает {e.now?.time??'без часа'} — у вас поставлено {e.value.time??e.value.title}. Правка держится. <DropEdit slug={slug} id={e._id!}/></div>)}
 {orphaned.map(e=><div key={e._id} style={{marginBottom:'.3rem'}}><b>{Number(e.date.slice(8))} числа</b> устав больше не назначает того собрания, которое вы правили. <DropEdit slug={slug} id={e._id!}/></div>)}
 </div>;
}
