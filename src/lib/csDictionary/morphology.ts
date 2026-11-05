import { buildLegacyView, type DictionaryRecord } from './legacyView';
import { PARADIGMS } from '@/lib/morphology/paradigms';
import { ADJECTIVES } from '@/lib/morphology/adjectives';
import { CONJUGATIONS } from '@/lib/morphology/conjugations';
import { toChurchSlavonic } from '@/lib/morphology/orthography';
import {analyses,nounSlots} from '@/lib/morphology/tags';
import { splitClitic } from '@/lib/morphology/stems';
import { civilKey } from '@/lib/cslav/core';
import type { Paradigm, Segment } from './types';
const number=(s:string):string=>s.startsWith('sg')?'единственное число':s.startsWith('pl')?'множественное число':s.startsWith('du')?'двойственное число':'';
const cases:Record<string,string>={Nom:'именительный',Gen:'родительный',Dat:'дательный',Acc:'винительный',Ins:'творительный',Loc:'местный',Voc:'звательный'};
export function slotLabel(slot:string):string{
 if(slot==='inf')return 'Инфинитив';
 const tense:Record<string,string>={pres:'Настоящее',imp:'Повелительное',imperf:'Имперфект',aor:'Аорист',partPerf:'Причастие перфекта (л-форма)',partPresActSg:'Причастие настоящего действительное (краткое)',partPresAct:'Причастие настоящего действительное',partPresPass:'Причастие настоящего страдательное',partPastAct:'Причастие прошедшего действительное',partPastPass:'Причастие прошедшего страдательное'};
 if(tense[slot])return tense[slot];
 const m=/^(pres|imperf|aor|imp)(Sg|Pl|Du)(\d+)$/.exec(slot);
 if(m)return `${tense[m[1]]} · ${number(m[2].toLowerCase())} · ${m[3].split('').join('/')} лицо`;
 const tags=Object.entries(cases).filter(([k])=>slot.includes(k)).map(([,v])=>v).join('/');
 if(slot==='plMAccFNomAcc')return 'Множественное число · мужской род, винительный / женский род, именительный и винительный';
 const gender=/^(sg|pl|du)([MFN]+)(?=Nom|Gen|Dat|Acc|Ins|Loc|Voc|$)/.exec(slot)?.[2];return [number(slot),gender?[...gender].map(g=>({M:'мужской род',F:'женский род',N:'средний род'} as Record<string,string>)[g]).join('/'):'',tags].filter(Boolean).join(' · ')||slot;
}
const letters=(s:string):string=>civilKey(s).replace(/\s/g,'');
/** A boundary is offered only if exactly one engine stem matches. The output is slices of the exact surface string. */
export function segmentsFor(value:string,stems:string[],clitic=''):Segment[]|null{
 const tail=clitic&&value.endsWith(clitic)?clitic:'';const body=tail?value.slice(0,-tail.length):value;
 const candidates=new Set<number>();
 for(const stem of stems){const k=letters(toChurchSlavonic(stem));if(!k)continue;
  const points=[...body];for(let i=1;i<=points.length;i++){
   const prefix=points.slice(0,i).join('');if(letters(prefix)===k&&(!points[i]||!/^\p{M}$/u.test(points[i])))candidates.add(prefix.length);
  }
 }
 if(candidates.size!==1)return null;const at=[...candidates][0];
 return [{kind:'stem',text:body.slice(0,at)},{kind:'ending',text:body.slice(at)},...(tail?[{kind:'clitic' as const,text:tail}]:[])];
}
export function paradigmsFor(row:DictionaryRecord,id:string):{known:boolean;paradigms:Paradigm[];extra:{value:string;properties:string}[]}{
 const view=buildLegacyView(row,id),out:Paradigm[]=[];
 const source=row.morphologyLemma??row.name??'',parts=splitClitic(source);const reflexive=/(с[яѧ])$/.exec(parts.head)?.[1]??'';
 const engine=PARADIGMS[row.scheme??'']??ADJECTIVES[row.scheme??'']??CONJUGATIONS[row.scheme??''];
 let stems:string[]=[];try{stems=engine?Object.values(engine.stems(reflexive?parts.head.slice(0,-reflexive.length):parts.head)):[];}catch{/* Unsupported source stays whole. */}
 const clitic=toChurchSlavonic(reflexive)+parts.clitic;
 const push=(kind:string,title:string,table:Record<string,{value:string;stored:boolean}[]>,allowSegments=true):void=>{
  out.push({kind,title,slots:Object.entries(table).map(([slot,forms])=>({id:slot,label:slotLabel(slot),forms:forms.map(f=>({value:toChurchSlavonic(f.value),origin:f.stored?'stored' as const:'generated' as const,grammar:slot,segments:allowSegments&&view.known?segmentsFor(toChurchSlavonic(f.value),stems,clitic):null}))})).filter(s=>s.forms.length)});
 };
 if(view.noun)push('noun','Склонение',view.noun);
 if(view.adjective){push('adjective-brev','Краткие формы',view.adjective.brev);push('adjective-plen','Полные формы',view.adjective.plen);}
 if(view.verb)push('verb','Спряжение',view.verb);
 for(const p of view.participles??[]){push('participle-brev',p.title+' · краткие',p.table.brev,false);push('participle-plen',p.title+' · полные',p.table.plen,false);}
 let extra=view.extra;
 if(['SPRO','NUM','NUMR'].includes((row.properties??'').split(',')[0])){
  const slots=new Map<string,{value:string;stored:boolean}[]>();const used=new Set<string>();
  for(const f of row.forms??[])for(const a of analyses(f.properties??''))for(const slot of nounSlots(a)){
   if(!f.value)continue;const list=slots.get(slot)??[];if(!list.some(x=>x.value===f.value))list.push({value:f.value,stored:true});slots.set(slot,list);used.add(f.value+'|'+(f.properties??''));
  }
  if(slots.size)push('stored-case-forms',(row.properties??'').startsWith('SPRO')?'Формы местоимения':'Падежные формы числительного',Object.fromEntries(slots),false);
  extra=extra.filter(f=>!used.has(f.value+'|'+f.properties));
 }
 return {known:view.known,paradigms:out,extra};
}
