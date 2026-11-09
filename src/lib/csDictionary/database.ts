import Database from 'better-sqlite3';
import {sourceExamples} from './examples';
import type { Article, SourceEntry, SearchResult, SearchItem, Direction } from './types';
import { civilKey } from '@/lib/cslav/core';
import { russianKey } from './dsl';
export function readableAnalysis(value:string):string{
 const parts=value.split(' / ').filter(Boolean);
 // The same attested form is indexed both with its original tags and its labelled paradigm slots.
 const labelled=parts.filter(p=>/[А-Яа-яЁё]/u.test(p));
 if(labelled.length===parts.length||labelled.length&&parts.filter(p=>!/[А-Яа-яЁё]/u.test(p)).every(p=>/^(sg|pl|du|nom|gen|dat|acc|ins|loc|voc|[,/])+$/u.test(p)))return [...new Set(labelled)].join(' / ');
 const labels:Record<string,string>={sg:'единственное число',pl:'множественное число',du:'двойственное число',nom:'именительный',gen:'родительный',dat:'дательный',acc:'винительный',ins:'творительный',loc:'местный',voc:'звательный',m:'мужской род',f:'женский род',n:'средний род',inf:'инфинитив',pres:'настоящее время',fut:'будущее время',aor:'аорист',imper:'повелительное наклонение',clit:'энклитика',brev:'краткая форма',plen:'полная форма',act:'действительное',pass:'страдательное',perf:'перфект',imperf:'имперфект'};
 return [...new Set(parts.map(p=>p.replace(/[A-Za-z]+/g,t=>labels[t]??t).replace(/,/g,' · ')))].join(' / ');
}
export function createPublication(db:Database.Database):void{
 db.exec(`CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE articles(id TEXT PRIMARY KEY,name TEXT NOT NULL,pos TEXT NOT NULL,payload TEXT NOT NULL);
 CREATE TABLE sources(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
 CREATE TABLE forms(key TEXT NOT NULL,lexemeId TEXT NOT NULL,surface TEXT NOT NULL,grammar TEXT NOT NULL,origin TEXT NOT NULL,rank INTEGER NOT NULL,PRIMARY KEY(key,lexemeId,surface,grammar,origin));
 CREATE INDEX forms_lookup ON forms(key,rank,lexemeId);
 CREATE TABLE anchors(id TEXT NOT NULL,lexemeId TEXT NOT NULL,sourceId TEXT NOT NULL,text TEXT NOT NULL,translation TEXT,number TEXT,PRIMARY KEY(id,lexemeId));
 CREATE INDEX anchors_lexeme ON anchors(lexemeId);
 CREATE TABLE translations(key TEXT NOT NULL,lexemeId TEXT NOT NULL,anchorId TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(key,lexemeId,anchorId));
 CREATE INDEX translations_lookup ON translations(key,lexemeId);
 CREATE VIRTUAL TABLE explanations USING fts5(lexemeId UNINDEXED,text,tokenize='unicode61');
 CREATE TABLE relationDecisions(id TEXT PRIMARY KEY,payload TEXT NOT NULL);`);
}
export class DictionaryPublication{
 readonly version:string;
 constructor(readonly db:Database.Database){const m=Object.fromEntries((db.prepare('SELECT key,value FROM metadata').all() as {key:string;value:string}[]).map(r=>[r.key,r.value]));if(m.state!=='complete'||m.format!=='cs-publication-v1'||m.scopeChecked!=='1')throw Error('Dictionary publication is incomplete');this.version=m.version;}
 relationView(id:string):Pick<Article,'id'|'name'|'pos'|'relations'>|null {const r=this.db.prepare('SELECT payload FROM articles WHERE id=?').get(id) as {payload:string}|undefined;if(!r)return null;const a=JSON.parse(r.payload) as Article;return {id:a.id,name:a.name,pos:a.pos,relations:a.relations};}
 article(id:string):Article|null {const r=this.db.prepare('SELECT payload FROM articles WHERE id=?').get(id) as {payload:string}|undefined;if(!r)return null;const a=JSON.parse(r.payload) as Article;for(const f of a.extra)f.grammar=readableAnalysis(f.grammar);if(a.examples===undefined){a.examples=a.sources.filter(r=>r.mappingStatus==='verified').flatMap(r=>this.source(r.id)?.examples??[]);}return a;}
 source(id:string):SourceEntry|null {const r=this.db.prepare('SELECT payload FROM sources WHERE id=?').get(id) as {payload:string}|undefined;if(!r)return null;const s=JSON.parse(r.payload) as SourceEntry;s.examples??=sourceExamples(s);return s;}
 search(query:string,direction:Direction,cursor=0,limit=20):SearchResult{
  const key=direction==='cu-ru'?civilKey(query):russianKey(query);if(!key||[...key].length>120)throw Error('Invalid query');
  const prefix=[...key].length>1,upper=key+'\uffff';let rows:SearchItem[];
  if(direction==='cu-ru'){
   rows=this.db.prepare(`WITH candidates AS (
    SELECT f.lexemeId id,f.origin AS "match",f.surface matched,
     coalesce(group_concat(nullif(f.grammar,''),' / ') OVER (PARTITION BY f.lexemeId,f.key,f.surface),'') grammar,
     f.rank+CASE WHEN f.key=? THEN 0 ELSE 10 END rank,
     row_number() OVER (PARTITION BY f.lexemeId ORDER BY f.rank+CASE WHEN f.key=? THEN 0 ELSE 10 END,f.surface) choice
    FROM forms f WHERE f.key>=? AND f.key${prefix?'<':'='}?)
    SELECT c.id,a.name,a.pos,c."match",CASE WHEN c."match"='lemma' THEN a.name ELSE c.matched END matched,c.grammar,c.rank FROM candidates c JOIN articles a ON a.id=c.id WHERE c.choice=1 ORDER BY c.rank,a.name,c.id LIMIT ? OFFSET ?`).all(key,key,key,prefix?upper:key,limit+1,cursor) as SearchItem[];
   return {version:this.version,query,direction,items:rows.slice(0,limit).map(r=>({...r,exact:r.rank<10,grammar:readableAnalysis(r.pos==='noun'?r.grammar.replace(/ · (мужской род|женский род|средний род)/g,''):r.grammar)})),nextCursor:rows.length>limit?String(cursor+limit):null};
  }else{
   const translated=this.db.prepare(`SELECT t.lexemeId id,a.name,a.pos,'translation' AS "match",t.value matched,'' grammar,CASE WHEN t.key=? THEN 0 ELSE 10 END rank FROM translations t JOIN articles a ON a.id=t.lexemeId WHERE t.key>=? AND t.key${prefix?'<':'='}? GROUP BY t.lexemeId ORDER BY rank,a.name LIMIT 100000`).all(key,key,prefix?upper:key) as SearchItem[];
   const terms=key.match(/[\p{L}\p{N}]+/gu)??[];const expression=terms.map(t=>'"'+t.replace(/"/g,'""')+'"'+(prefix?'*':'')).join(' AND ');
   const explanations=expression?this.db.prepare(`SELECT e.lexemeId id,a.name,a.pos,'explanation' AS "match",substr(min(e.text),1,220) matched,'' grammar,30 rank FROM explanations e JOIN articles a ON a.id=e.lexemeId WHERE explanations MATCH ? GROUP BY e.lexemeId ORDER BY a.name LIMIT 100000`).all(expression) as SearchItem[]:[];
   rows=[...translated,...explanations];
  }
  const unique=new Map<string,SearchItem>();for(const r of rows){if(!unique.has(r.id))unique.set(r.id,r);}
  const all=[...unique.values()],items=all.slice(cursor,cursor+limit).map(r=>({...r,exact:r.rank<10}));return {version:this.version,query,direction,items,nextCursor:cursor+items.length<all.length?String(cursor+items.length):null};
 }
}
let cache:{path:string;publication:DictionaryPublication}|undefined;
export function dictionaryPublication():DictionaryPublication{
 const path=process.env.CS_DICTIONARY_DB;if(!path)throw Error('Dictionary publication is not configured');
 if(cache?.path===path)return cache.publication;
 const publication=new DictionaryPublication(new Database(path,{readonly:true,fileMustExist:true}));cache?.publication.db.close();cache={path,publication};return publication;
}
