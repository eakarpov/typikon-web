export interface Source {id:string;title:string;url:string;edition:string;role:string;locator:string}
export interface Note {id?:string;title:string;summary:string;detail:string;author:string;status:string;checkedAt:string;sourceRefs:{sourceId:string;locator:string}[];furtherReading?:string[]}
export interface Selection {mode:'day'|'study';date?:string;service?:string;ordo?:string;variant?:string;ustav?:string;part?:string;lang?:string}
export interface Line {id:string;text:string|null;absent?:string;kind:string;label?:string;language?:string;edition?:string;address?:string;sourceUrl?:string;citation?:string;repeatCount:number;poklon?:string|boolean;voiced?:string;audible:boolean;contentHash:string;scripture?:unknown;translations:{text:string;language:string;edition:string;editionLabel?:string;publisher?:string;year?:number;sourceUrl?:string;translator?:string;basis:'edition'|'confirmed'}[]}
export interface Node {id:string;title:string;topicId:string;kind:string;explanation:Note;lines:Line[];evidence:{text:string;verified:boolean;kind:string}[];audibleCue?:string;condition?:string;optional?:boolean;contentHash:string;wordSenses:{forms:string[];topicId:string;explanation:Note}[]}
export interface Service {id:string;sessionKey:string;selection:Record<string,unknown>;title:string;guide:Note;civil?:string;partLabel?:string;stoyanie?:string;nodes:Node[];facts:{label:string;value:unknown;verified:boolean}[];rules:{id:string;category:string;label:string;reason?:string;sourceRefs:{sourceId:string;locator:string}[];verified:boolean;status:string}[];layers:string[];coverage:{absenceCounts?:Record<string,number>;structure:boolean;texts:boolean;explanations:boolean;translations:number;translationTotal:number;missing:string[];errors:string[]};assemblyStatus:string;error?:string;replacedBy?:string}
export interface Bundle {schemaVersion:1;corpusVersion:string;editorialVersion:string;editorialHash:string;day:unknown;sources:Source[];services:Service[];trusted?:boolean}
export interface Catalog {schemaVersion:1;corpusVersion:string;editorialVersion:string;editorialHash:string;services:{id:string;title:string;service:string;family:string;variant?:string;rite:string;tradition:string;guide:Note}[];sources:Source[];ustavy:{ustav:string;label:string}[];topics:Record<string,Note>}
export const cleanWord=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f\u0483-\u0489]/g,'').toLowerCase().replace(/[ѣє]/g,'е').replace(/ѿ/g,'от').replace(/ѳ/g,'ф').replace(/ѵ/g,'и').replace(/ѕ/g,'з').replace(/[ѧꙗ]/g,'я').replace(/[ꙋѹ]/g,'у').replace(/[і]/g,'и').replace(/[ѡ]/g,'о').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function searchNodes(service:Service,query:string){const q=cleanWord(query);return q?service.nodes.filter(n=>cleanWord(n.title).includes(q)||n.lines.some(l=>l.audible&&l.text&&cleanWord(l.text).includes(q))):[];}
export function validateSelection(value:unknown):Selection {
 const b=value as Record<string,unknown>;if(!b||!['day','study'].includes(String(b.mode)))throw Error('Выберите режим.');
 const out:Selection={mode:b.mode as Selection['mode']};
 for(const key of ['service','ordo','variant','ustav','part','lang'] as const)if(b[key]!==undefined){if(typeof b[key]!=='string'||!/^[-a-zA-Z0-9_:/]{1,120}$/.test(b[key] as string))throw Error('Неверный параметр '+key);out[key]=b[key] as string;}
 if(out.mode==='day') {if(typeof b.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||!Number.isFinite(Date.parse(b.date))||new Date(b.date).toISOString().slice(0,10)!==b.date||b.date<'1900-01-01'||b.date>'2099-12-31'||!out.service)throw Error('Укажите дату и службу.');out.date=b.date;delete out.ordo;}
 else {if(!out.ordo)throw Error('Выберите последование.');delete out.service;}
 return out;
}
export interface Entry {key:string;snapshotId:string;nodeId:string;contentHash:string;title:string;nodeTitle:string;selection:Selection;saved:Record<string,boolean>;savedDetails?:Record<string,{contentHash:string;title:string}>;updatedAt?:string}
export interface Progress {revision:number;entries:Record<string,Entry>;receipts:string[]}
export interface Operation {id:string;revision:number;action:'position'|'save'|'remove';entry:Entry;done?:boolean}
const safeId=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9:_-]{1,160}$/.test(v)&&!['__proto__','prototype','constructor'].includes(v);
export function validateEntry(raw:unknown):Entry {
 const b=raw as Entry;if(!b||![b.key,b.snapshotId,b.nodeId,b.contentHash].every(safeId)||typeof b.title!=='string'||b.title.length>240||typeof b.nodeTitle!=='string'||b.nodeTitle.length>240)throw Error('Неверное сохранённое место.');
 const saved:Record<string,boolean>={};for(const [id,value] of Object.entries(b.saved??{})){if(!safeId(id)||typeof value!=='boolean'||Object.keys(saved).length>3000)throw Error('Неверные сохранения.');saved[id]=value;}
 return {key:b.key,snapshotId:b.snapshotId,nodeId:b.nodeId,contentHash:b.contentHash,title:b.title,nodeTitle:b.nodeTitle,selection:validateSelection(b.selection),saved};
}
export function applyProgress(original:Progress,raw:Operation):Progress {
 if(!safeId(raw.id))throw Error('Неверная операция.');if(original.receipts.includes(raw.id))return original;
 if(raw.revision!==original.revision)throw Error('conflict');const entry=validateEntry(raw.entry),s=structuredClone(original);const old=s.entries[entry.key];
 if(raw.action==='remove')delete s.entries[entry.key];
 else if(raw.action==='position'||raw.action==='save') {
  if(raw.action==='save'&&typeof raw.done!=='boolean')throw Error('Неверная отметка.');
  const saved={...old?.saved},savedDetails={...old?.savedDetails};if(raw.action==='save'){saved[entry.nodeId]=!!raw.done;savedDetails[entry.nodeId]={contentHash:entry.contentHash,title:entry.nodeTitle};}
  s.entries[entry.key]={...entry,saved,savedDetails,updatedAt:new Date().toISOString()};
 }else throw Error('Неверная операция.');
 if(Object.keys(s.entries).length>200)throw Error('Сохранено слишком много служб. Удалите ненужные записи.');
 s.revision++;s.receipts=[...s.receipts,raw.id].slice(-2000);return s;
}
export const initialProgress=():Progress=>({revision:0,entries:{},receipts:[]});
export function entryFor(s:Service,selection:Selection,node:Node):Entry{return {key:s.sessionKey,snapshotId:s.id,nodeId:node.id,contentHash:node.contentHash,title:s.title,nodeTitle:node.title,selection,saved:{}};}
export function restoreNode(s:Service,e?:Entry){if(!e)return undefined;const n=s.nodes.find(n=>n.id===e.nodeId&&n.contentHash===e.contentHash);if(n&&s.id!==e.snapshotId&&s.nodes.filter(x=>x.id.split(':')[0]===n.id.split(':')[0]).length>1)return undefined;return n;}

export const selectionSignature=(s:Selection)=>JSON.stringify(Object.fromEntries(Object.entries(s).filter(([,v])=>v!=null&&v!=='').sort(([a],[b])=>a.localeCompare(b))));

export function searchOccurrences(service:Service,query:string){
 const q=cleanWord(query);if(!q)return [];
 return service.nodes.flatMap(n=>{
  const lines=n.lines.filter(l=>l.audible&&l.text&&cleanWord(l.text).includes(q)).map(l=>({nodeId:n.id,lineId:l.id,title:n.title,context:excerpt(l.text!,query)}));
  return lines.length?lines:cleanWord(n.title).includes(q)?[{nodeId:n.id,lineId:'',title:n.title,context:n.audibleCue??''}]:[];
 });
}

export function excerpt(text:string,query:string){const normalized=cleanWord(text),q=cleanWord(query),at=normalized.indexOf(q);return text.length<260?text:(at>70?'…':'')+normalized.slice(Math.max(0,at-70),at+q.length+130)+'…';}
export function importedSelection(service:Service):Selection {
 const s=service.selection??{},use=s.use as {rite?:string;tradition?:string}|undefined;
 return validateSelection(s.mode==='day'&&s.date?{mode:'day',date:s.date,service:s.service,...(s.stoyanie?{part:s.stoyanie}:{}),...(s.variant?{variant:s.variant}:{}),...(use?.rite&&use?.tradition?{ustav:use.rite+'/'+use.tradition}:{})}:{mode:'study',ordo:s.ordoId});
}
