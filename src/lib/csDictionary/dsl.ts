import { createHash } from 'node:crypto';
import type { Run, Paragraph, SourceEntry, MeaningAnchor } from './types';
const hash=(s:string):string=>createHash('sha256').update(s).digest('hex');
export const russianKey=(s:string):string=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/ѣ/g,'е').replace(/і/g,'и').replace(/ѳ/g,'ф').replace(/ё/g,'е').replace(/ъ(?=\P{L}|$)/gu,'').replace(/\s+/g,' ').trim();
export function safeTarget(value:string):string|undefined {
 if(value.endsWith(':'))return 'lookup:'+value.slice(0,-1);
 try{const u=new URL(value);if(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password)return u.toString();}catch{/* Internal DSL references remain inert text. */}
 return undefined;
}
/** A data parser, never HTML: unknown directives are removed, their text retained. */
export function parseDsl(raw:string):Paragraph[]{
 const out:Paragraph[]=[];
 for(const line of raw.split(/\r?\n/)){
  const runs:Run[]=[];const stack:string[]=[];let reference:string|null=null,refText='';let skip=0;
  const parts=line.trim().split(/(\\[\[\]]|\[[^\]\n]+\])/g);
  for(const part of parts){
   if(!part)continue;
   if(part.startsWith('\\')){if(!skip)runs.push({text:part.slice(1),kind:'text'});continue;}
   if(part.startsWith('[')&&part.endsWith(']')){
    const tag=part.slice(1,-1),close=tag.startsWith('/'),name=tag.replace(/^\//,'').split(' ')[0];
    if(['p','s','url'].includes(name)){
     if(name==='url'){if(close){const target=safeTarget(refText.trim());if(target&&runs.length)runs[runs.length-1].target=target;reference=null;refText='';}else{reference='url';refText='';}continue;}
     skip+=close?-1:1;skip=Math.max(0,skip);continue;
    }
    if(name==='ref'){if(close){const text=refText.trim();runs.push({text,kind:'reference',target:safeTarget(text)??('lookup:'+text.replace(/:$/,''))});reference=null;refText='';}else{reference='ref';refText='';}continue;}
    if(['b','i','c'].includes(name)){if(close){const at=stack.map(s=>s.split(' ')[0]).lastIndexOf(name);if(at>=0)stack.splice(at,1);}else stack.push(tag);}
    continue;
   }
   if(skip)continue;if(reference){refText+=part;continue;}
   const kind:Run['kind']=stack.some(x=>x==='c firebrick')?'church':stack.includes('b')?'strong':stack.includes('i')?'emphasis':'text';
   if(part.trim())runs.push({text:part,kind});
  }
  if(runs.some(r=>r.text.trim()))out.push({runs});
 }
 return out;
}
export function sourceEntry(id:string,entryId:string,code:string,title:string|null,version:string,raw:string):SourceEntry{
 const paragraphs=parseDsl(raw);const text=paragraphs.map(p=>p.runs.map(r=>r.text).join('')).join('\n');
 const anchors:MeaningAnchor[]=[];
 // Explicit dictionary numbering is retained, not invented from comma-separated glosses.
 const numbered:{number:string;start:number;end:number}[]=[];let offset=0;
 for(const p of paragraphs){for(const r of p.runs){const m=r.kind==='strong'?/^\s*(\d{1,2})[.)]\s*$/.exec(r.text):null;if(m)numbered.push({number:m[1],start:offset,end:offset+r.text.length});offset+=r.text.length;}offset++;}
 // Plain parenthesized enumeration is also explicit; parenthesized Bible references are not meanings.
 for(const m of text.matchAll(/(?<!\d)(\d{1,2})\)\s*/g)){
  const start=m.index!,before=text.slice(0,start);if(start&& !/\s/.test(text[start-1]))continue;
  if(before.lastIndexOf('(')>before.lastIndexOf(')'))continue;
  if(!numbered.some(n=>n.start<=start&&n.end>=start))numbered.push({number:m[1],start,end:start+m[0].length});
 }
 numbered.sort((a,b)=>a.start-b.start);
 const chunks=numbered.length?numbered.map((m,i)=>({number:m.number,text:text.slice(m.end,numbered[i+1]?.start??text.length).trim()})):[{number:null,text}];
 const equivalent=(values:string[]):string|null=>values.filter(s=>s.length<=110&&!/[‹›—]/.test(s)&&! /^(см|ср|греч|евр|лат|тж)(?:\.|\s|$)/i.test(s.trim())&&!/(котор|гд[еѣ]|наход|пом[еѣ]щ|н[еѣ]котор|означа)/i.test(s)).flatMap(s=>s.split(/[;,]/)).map(s=>s.trim().replace(/[.。]$/,'')).filter(s=>s.length>=1&&s.length<90&&s.split(/\s+/).length<=6&&!/[\d<>]/.test(s)&&!/(означает|котор|см\.|союз|нареч|прилаг)/i.test(s)).join('; ')||null;
 for(const chunk of chunks){
  let candidates:string[]=[];
  if(code==='СЦРЯ'){candidates=[...chunk.text.matchAll(/▸\s*([^◂]+)◂/g)].map(m=>m[1]);}
  if(code==='Св')candidates=[chunk.text.split(/[.!?:（(\n]/)[0]];
  const translation=equivalent(candidates);
  anchors.push({id:hash([id,chunk.number??'',chunk.text].join('\0')),sourceId:id,sourceVersion:version,text:chunk.text,translation:chunk.number?translation:null,number:chunk.number,status:chunk.number?'source-numbered':'unsegmented'});
  // An unnumbered source block is not a single meaning. Link only its explicitly marked equivalent fragment.
  if(!chunk.number)for(const candidate of candidates){
   const fragmentTranslation=equivalent([candidate]);if(!fragmentTranslation)continue;
   const excerpt=candidate.trim().replace(/[.。]$/,'');
   anchors.push({id:hash([id,'fragment',excerpt].join('\0')),sourceId:id,sourceVersion:version,text:excerpt,translation:fragmentTranslation,number:null,status:'source-fragment'});
  }
 }
 // These sources use plain equivalent lists rather than СЦРЯ's ▸…◂ markers.
 // Add addressable fragments without changing existing sense IDs or treating
 // quotations and phrase headings as translations of the whole lexeme.
 const extra:string[]=[];
 if(code==='od'&&!/[‹›]/.test(text)){
  for(const part of text.split(/(?:^|[;,]\s*|\s+)\d{1,2}\.\s+/)){
   const gloss=part.trim().replace(/[.。]$/,'');
   if(/^[\p{Script=Cyrillic}\p{M} ,;—-]+$/u.test(gloss))extra.push(gloss);
  }
 }
 if(code==='ГлтНЗ'){
  // The Russian list follows the parenthesized Greek/Latin equivalents;
  // the first full stop starts a Scripture reference or an example.
  for(const m of text.matchAll(/(?:^|\n)[^\n]*?\([^()\n]*\)\s*–\s*([^.!?:（(\n]+)/g))extra.push(m[1]);
 }
 for(const candidate of extra){
  const translation=equivalent([candidate]);if(!translation)continue;
  const excerpt=candidate.trim().replace(/[.。]$/,'');
  const anchorId=hash([id,'fragment',excerpt].join('\0'));
  if(!anchors.some(a=>a.id===anchorId))anchors.push({id:anchorId,sourceId:id,sourceVersion:version,text:excerpt,translation,number:null,status:'source-fragment'});
 }
 return {id,entryId,sourceCode:code,title:title??`Источник ${code} (не установлен)`,bibliographyStatus:title?'identified':'unknown',version,paragraphs,text,anchors};
}
