import type Database from 'better-sqlite3';
import {toChurchSlavonic} from '@/lib/morphology/orthography';
import type {Article,DataOrigin} from './types';
const unknown=():DataOrigin[]=>[{sourceId:'source:unknown',title:'Происхождение неизвестно',origin:'unknown',attribution:'unknown'}];
/** Exact rendering is used here, not search normalization: orthographic variants are not provenance identities. */
export function attachOrigins(db:Database.Database,a:Article):void{
 const rows=db.prepare(`SELECT t.kind,t.payload target,e.payload evidence,s.payload source FROM targets t LEFT JOIN evidence e ON e.targetId=t.id LEFT JOIN sources s ON s.id=e.sourceId WHERE t.lexemeId=? AND t.scope IN ('current','prepared') AND t.kind IN ('lexeme','scheme','form')`).all(a.id) as {kind:string;target:string;evidence:string|null;source:string|null}[];
 const lexeme:DataOrigin[]=[],scheme:DataOrigin[]=[],forms=new Map<string,DataOrigin[]>();
 for(const row of rows){const target=JSON.parse(row.target) as {id:string;value:{value?:string;code?:string}};
  if(row.kind==='scheme'&&target.value.code!==a.scheme)continue;
  const evidence=row.evidence?JSON.parse(row.evidence) as {sourceId:string;origin:string;attribution:string;carrierVersionId:string;reportedSourceId?:string}:null;
  const source=row.source?JSON.parse(row.source) as {title?:string}:null;
  const origin:DataOrigin=evidence?{targetId:target.id,sourceId:evidence.sourceId,title:source?.title??'Происхождение неизвестно',origin:evidence.origin,attribution:evidence.attribution,carrierVersionId:evidence.carrierVersionId,reportedSourceId:evidence.reportedSourceId}:unknown()[0];
  if(row.kind==='lexeme')lexeme.push(origin);else if(row.kind==='scheme')scheme.push(origin);else if(target.value.value){const key=toChurchSlavonic(target.value.value);forms.set(key,[...(forms.get(key)??[]),origin]);}
 }
 const unique=(values:DataOrigin[]):DataOrigin[]=>[...new Map(values.map(v=>[JSON.stringify(v),v])).values()];
 a.provenance={lexeme:lexeme.length?unique(lexeme):unknown(),scheme:scheme.length?unique(scheme):unknown()};
 for(const f of [...a.extra,...a.paradigms.flatMap(p=>p.slots.flatMap(s=>s.forms))])f.provenance=f.origin==='generated'?a.provenance.scheme:unique(forms.get(f.value)??unknown());
}
