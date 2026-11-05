import type Database from 'better-sqlite3';
import {civilKey} from '@/lib/cslav/core';
import type {Article,SourceEntry,ReviewStatus} from './types';
interface Link{externalKey:string;candidateIds:string[];method:string}
export function sourceScoper(raw:Database.Database,links:Link[],recovery:{_id:string;externalKey:string}[]):(a:Article,s:SourceEntry)=>ReviewStatus|null{
 const byKey=new Map<string,{id:string;status:ReviewStatus}[]>();const keys=new Map<string,Map<string,ReviewStatus>>();
 const key=(s:string):string=>civilKey(s.replace(/:$/,''));
 const add=(external:string,id:string,status:ReviewStatus):void=>{const owners=byKey.get(external)??[];owners.push({id,status});byKey.set(external,owners);const own=keys.get(id)??new Map();own.set(key(external),status);keys.set(id,own);};
 for(const l of links)for(const id of l.candidateIds)add(l.externalKey,id,l.candidateIds.length===1&&['exact','verified-orthography'].includes(l.method)?'verified':'proposed');
 for(const r of recovery)if(!keys.has(r._id))add(r.externalKey,r._id,'verified');
 const entries=new Map<string,Map<string,ReviewStatus>>();
 for(const g of raw.prepare('SELECT sourceEntryId,target FROM grammar').iterate() as Iterable<{sourceEntryId:string;target:string}>){for(const o of byKey.get(g.target)??[]){const owners=entries.get(g.sourceEntryId)??new Map();if(owners.get(o.id)!=='verified')owners.set(o.id,o.status);entries.set(g.sourceEntryId,owners);}}
 const heading=raw.prepare('SELECT headers FROM entries WHERE id=?');const cache=new Map<string,string[]>();
 return (a,s)=>{const direct=entries.get(s.entryId)?.get(a.id);if(direct)return direct;let headers=cache.get(s.entryId);if(!headers){const row=heading.get(s.entryId) as {headers:string}|undefined;headers=row?(JSON.parse(row.headers) as string[]).map(key):[];cache.set(s.entryId,headers);}const statuses=headers.map(h=>keys.get(a.id)?.get(h)).filter(Boolean);return statuses.includes('verified')?'verified':statuses.length?'proposed':null;};
}
