import {unzipSync} from 'fflate';
import type {Bundle,Catalog} from './core';
export function importCompanion(bytes:Uint8Array,catalog?:Catalog):Bundle {
 if(bytes.length>40*1024*1024)throw Error('Слишком большой файл .ordo.');
 let total=0;const files=unzipSync(bytes,{filter:f=>{if(!['companion.json','manifest.json'].includes(f.name))return false;total+=f.originalSize;if(total>32*1024*1024)throw Error('Слишком большой слой Спутника.');return true;}});
 if(!files['companion.json'])throw Error('В этом .ordo нет материалов Спутника. Откройте его в «Службе дня».');
 const d=JSON.parse(new TextDecoder().decode(files['companion.json'])) as Bundle;
 if(d.schemaVersion!==1||!Array.isArray(d.services)||!d.services.length||d.services.length>16||!Array.isArray(d.sources))throw Error('Неверный формат Спутника.');
 const note=(n:any)=>n&&['title','summary','detail','author'].every(k=>typeof n[k]==='string')&&Array.isArray(n.sourceRefs)&&n.sourceRefs.every((r:any)=>typeof r.sourceId==='string'&&typeof r.locator==='string');
 let count=0;for(const s of d.services){if(!Array.isArray(s.nodes)||s.nodes.length>10000||typeof s.sessionKey!=='string'||typeof s.id!=='string'||typeof s.title!=='string'||!note(s.guide)||!s.coverage||!Array.isArray(s.facts)||!Array.isArray(s.rules))throw Error('Неверная карта службы.');for(const n of s.nodes){if(!Array.isArray(n.lines)||!Array.isArray(n.evidence)||!note(n.explanation)||!Array.isArray(n.wordSenses)||typeof n.title!=='string'||typeof n.id!=='string'||typeof n.contentHash!=='string')throw Error('Неверная часть службы.');for(const l of n.lines){if((l.text!==null&&typeof l.text!=='string')||!Array.isArray(l.translations))throw Error('Неверная строка.');l.translations=l.translations.filter(t=>['edition','confirmed'].includes(t.basis)&&typeof t.text==='string');}
 count+=n.lines.length;if(count>30000)throw Error('Слишком много строк.');}}
 // An archive's self-declared editorial hash is not an authority. It may carry
 // copied verified notes while attaching them to arbitrary text or positions.
 return {...d,trusted:false};
}
export const sourceHref=(url:string)=>/^https?:\/\//i.test(url)?url:undefined;
