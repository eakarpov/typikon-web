import {civilKey} from '@/lib/cslav/core';
import {russianKey} from './dsl';
import type {Article,Direction,SourceEntry} from './types';
import {DictionaryPublication,DictionaryVersionError} from './database';

export class DictionaryProfileError extends Error {
 constructor(readonly status:number,readonly code:string,message:string){super(message);}
}
export function dictionarySchema(url:URL):1|2 {
 const value=url.searchParams.get('schema')??'1';
 if(value!=='1'&&value!=='2')throw new DictionaryProfileError(400,'unsupported_schema','Неизвестная схема словаря');
 return Number(value) as 1|2;
}
/** @deprecated Implicit/schema=1 remains supported until old clients retire. */
export function dictionaryCompatibility(url:URL):Record<string,string>{
 if((url.searchParams.get('schema')??'1')!=='1')return {};
 const successor=new URL(url);successor.searchParams.set('schema','2');successor.searchParams.delete('cursor');
 return {'X-Dictionary-Schema-Deprecated':'true',Link:`<${successor.pathname}${successor.search}>; rel="successor-version"`,'Access-Control-Expose-Headers':'X-Dictionary-Schema-Deprecated, Link'};
}
// Bump when search normalization/ranking changes; a token never spans profiles.
const searchProfile='dictionary-search-1';
function key(query:string,direction:Direction){return direction==='cu-ru'?civilKey(query):russianKey(query);}
export function searchOffset(url:URL,version:string,query:string,direction:Direction,size:number):number {
 const cursor=url.searchParams.get('cursor');if(cursor===null)return 0;
 try{
  if(!url.searchParams.has('version')||cursor.length>4096||!/^[A-Za-z0-9_-]+$/.test(cursor))throw Error();
  const c=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8')) as unknown[];
  if(!Array.isArray(c)||c.length!==7||c[0]!==2||c[1]!==version||c[2]!==direction||c[3]!==key(query,direction)||c[4]!==searchProfile||c[5]!==size||!Number.isSafeInteger(c[6])||Number(c[6])<=0||Number(c[6])>100000)throw Error();
  return Number(c[6]);
 }catch{throw new DictionaryProfileError(400,'bad_cursor','Неверный курсор страницы');}
}
export function searchV2(p:DictionaryPublication,url:URL,query:string,direction:Direction,size:number){
 if(!key(query,direction))throw new DictionaryProfileError(400,'bad_request','Проверьте запрос');
 const page=p.search(query,direction,searchOffset(url,p.version,query,direction,size),size);
 return {...page,schemaVersion:2,dictionaryVersion:p.version,nextCursor:page.nextCursor===null?null:Buffer.from(JSON.stringify([2,p.version,direction,key(query,direction),searchProfile,size,Number(page.nextCursor)])).toString('base64url')};
}
type Row=Record<string,unknown>;
const row=(v:unknown):Row=>v&&typeof v==='object'&&!Array.isArray(v)?v as Row:{};
const list=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
function form(v:unknown):Row{
 const f=row(v),kind=f.formOrigin??(f.origin==='stored'?'dictionary':f.origin==='generated'?'generated':'unknown');
 const {origin,...rest}=f;
 return {...rest,...(kind==='dictionary'?{origin:'stored'}:kind==='generated'?{origin:'generated'}:{}),formOrigin:kind,reviewStatus:f.reviewStatus??'unknown',provenance:list(f.provenance),evidence:list(f.evidence)};
}
export function articleV2(p:DictionaryPublication,a:Article):Row{
 const sources=(v:unknown)=>list(v).map(value=>{const s=row(value);return {...s,mappingStatus:s.mappingStatus??'unknown',sourceVersion:p.source(String(s.id))?.version??null};});
 return {...a,schemaVersion:2,version:p.version,dictionaryVersion:p.version,
  sources:sources(a.sources),relatedSources:sources(a.relatedSources),examples:a.examples??[],
  paradigms:a.paradigms.map(p=>({...p,slots:p.slots.map(s=>({...s,forms:s.forms.map(form)}))})),extra:a.extra.map(form)};
}
/** @deprecated Compatibility projection; never label attested/unknown forms generated. */
export function legacyArticle(a:Article):Article {
 const forms=(values:unknown[])=>values.flatMap(v=>{const f=form(v);return f.formOrigin==='dictionary'||f.formOrigin==='generated'?[{...row(v),origin:f.origin}]:[];});
 const sources=(values:unknown[])=>values.filter(v=>['verified','proposed'].includes(String(row(v).mappingStatus)));
 return {...a,extra:forms(a.extra),paradigms:a.paradigms.map(p=>({...p,slots:p.slots.map(s=>({...s,forms:forms(s.forms)}))})),sources:sources(a.sources),relatedSources:a.relatedSources===undefined?undefined:sources(a.relatedSources)} as Article;
}
export function sourceV2(p:DictionaryPublication,s:SourceEntry){return {...s,examples:s.examples??[],schemaVersion:2,sourceVersion:s.version,publicationVersion:p.version,dictionaryVersion:p.version};}
export function dictionaryError(error:unknown):{status:number;body:unknown}{
 if(error instanceof DictionaryProfileError||error instanceof DictionaryVersionError)return {status:error.status,body:{error:{code:error.code,message:error.message}}};
 return {status:503,body:{error:{code:'unavailable',message:'Словарь временно недоступен'}}};
}
