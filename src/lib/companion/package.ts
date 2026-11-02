import {unzipSync} from 'fflate';
import type {Bundle,Catalog} from './core';
export function importCompanion(bytes:Uint8Array,catalog?:Catalog):Bundle {
 if(bytes.length>40*1024*1024)throw Error('Слишком большой файл .ordo.');
 let total=0;const files=unzipSync(bytes,{filter:f=>{if(!['companion.json','manifest.json'].includes(f.name))return false;total+=f.originalSize;if(total>32*1024*1024)throw Error('Слишком большой слой Спутника.');return true;}});
 if(!files['companion.json'])throw Error('В этом .ordo нет материалов Спутника. Откройте его в «Службе дня».');
 const d=JSON.parse(new TextDecoder().decode(files['companion.json'])) as Bundle;
 if(d.schemaVersion!==1||!Array.isArray(d.services)||!d.services.length||d.services.length>16||!Array.isArray(d.sources))throw Error('Неверный формат Спутника.');
 const note=(n:any)=>n&&['title','summary','detail','author'].every(k=>typeof n[k]==='string')&&(!n.furtherReading||(Array.isArray(n.furtherReading)&&n.furtherReading.every((x:any)=>typeof x==='string')))&&Array.isArray(n.sourceRefs)&&n.sourceRefs.every((r:any)=>typeof r.sourceId==='string'&&typeof r.locator==='string');
 if(!d.sources.every(s=>s&&['id','title','url'].every(k=>typeof (s as any)[k]==='string')))throw Error('Неверный источник.');
 let count=0;for(const s of d.services){if(!Array.isArray(s.nodes)||s.nodes.length>10000||typeof s.sessionKey!=='string'||typeof s.id!=='string'||typeof s.title!=='string'||!note(s.guide)||!s.coverage||!Array.isArray(s.facts)||!Array.isArray(s.rules))throw Error('Неверная карта службы.');for(const n of s.nodes){if(!Array.isArray(n.lines)||!Array.isArray(n.evidence)||!note(n.explanation)||!Array.isArray(n.wordSenses)||typeof n.title!=='string'||typeof n.id!=='string'||typeof n.contentHash!=='string')throw Error('Неверная часть службы.');for(const l of n.lines){if((l.text!==null&&typeof l.text!=='string')||!Array.isArray(l.translations))throw Error('Неверная строка.');l.translations=l.translations.filter(t=>['edition','confirmed'].includes(t.basis)&&typeof t.text==='string');}
 if(!n.evidence.every(e=>e&&typeof e.text==='string')||!n.wordSenses.every(w=>w&&Array.isArray(w.forms)&&w.forms.every(f=>typeof f==='string')&&note(w.explanation)))throw Error('Неверные пояснения.');
 count+=n.lines.length;if(count>30000)throw Error('Слишком много строк.');}}
 for(const s of d.services){s.assemblyStatus='Порядок из файла; назначение и календарные основания не подтверждены.';for(const r of s.rules){if(!r||typeof r.label!=='string')throw Error('Неверное основание.');r.sourceRefs=Array.isArray(r.sourceRefs)?r.sourceRefs:[];r.verified=false;r.status='Основание из файла, сверка не подтверждена';}for(const n of s.nodes)for(const e of n.evidence)e.verified=false;}
 // An archive's self-declared editorial hash is not an authority. It may carry
 // copied verified notes while attaching them to arbitrary text or positions.
 return {...d,trusted:false};
}
export const sourceHref=(url:string)=>/^https?:\/\//i.test(url)?url:undefined;
