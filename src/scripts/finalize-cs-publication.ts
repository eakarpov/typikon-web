/** Immutable derivative builds. Never opens a source or legacy database for writing. */
import Database from 'better-sqlite3';
import {copyFileSync,constants,existsSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validatePlanId,type DictionaryImportPlan} from '@/lib/dictionaryImport/plan';
import {hashFile} from '@/lib/dictionaryImport/files';
import {sourceEntry,russianKey} from '@/lib/csDictionary/dsl';
import {sourceScoper} from '@/lib/csDictionary/sourceScope';
import {attachOrigins} from '@/lib/csDictionary/origins';
import {mergeRelations} from '@/lib/csDictionary/decisions';
import {paradigmsFor,slotLabel} from '@/lib/csDictionary/morphology';
import {toChurchSlavonic} from '@/lib/morphology/orthography';
import {civilKey,csCanonical} from '@/lib/cslav/core';
import type {Article,SourceEntry,Relation,EtymologyReference} from '@/lib/csDictionary/types';
const arg=(k:string):string|undefined=>{const i=process.argv.indexOf(k);return i<0?undefined:process.argv[i+1];};
const base=arg('--base')!,out=arg('--out')!;if(!base||!out||existsSync(out))throw Error('Supply a base and a new output path');
try{copyFileSync(base,out,constants.COPYFILE_FICLONE);}catch{copyFileSync(base,out,constants.COPYFILE_EXCL);}
const db=new Database(out);const meta=Object.fromEntries((db.prepare('SELECT key,value FROM metadata').all() as {key:string;value:string}[]).map(r=>[r.key,r.value]));if(meta.state!=='complete')throw Error('Incomplete base');
db.prepare("UPDATE metadata SET value='building' WHERE key='state'").run();db.pragma('journal_mode=WAL');
if(arg('--refresh-sources')||arg('--scope-sources')){
 const raw=new Database((arg('--refresh-sources')??arg('--scope-sources'))!,{readonly:true,fileMustExist:true});
 raw.pragma('cache_size=-65536');db.pragma('cache_size=-262144');
 let scope:ReturnType<typeof sourceScoper>|null=null;
 if(arg('--scope-sources')){const plan=JSON.parse(readFileSync(arg('--plan')!,'utf8')) as DictionaryImportPlan;validatePlanId(plan);if(hashFile(arg('--scope-sources')!)!==plan.stagingSha256||hashFile(arg('--recovery')!)!==plan.recoverySha256)throw Error('Source scope inputs do not match reviewed plan');scope=sourceScoper(raw,plan.links,JSON.parse(readFileSync(arg('--recovery')!,'utf8')) as {_id:string;externalKey:string}[]);}

 const heading=raw.prepare('SELECT headers FROM entries WHERE id=?');
 const nameKey=(s:string):string=>csCanonical(s.toLowerCase().replace(/ї/g,'і')).normalize('NFD').replace(/\u0486/g,'').replace(/\u0300$/, '\u0301').normalize('NFC');
 const get=raw.prepare('SELECT raw FROM fragments WHERE id=?'),put=db.prepare('UPDATE sources SET payload=? WHERE id=?');
 const rebuilt=new Map<string,SourceEntry>();
 db.transaction(()=>{for(const r of db.prepare('SELECT id,payload FROM sources').all() as {id:string;payload:string}[]){
  const old=JSON.parse(r.payload) as SourceEntry;const original=get.get(r.id) as {raw:string}|undefined;if(!original)throw Error('Missing original fragment '+r.id);
  const s=arg('--refresh-sources')?sourceEntry(r.id,old.entryId,old.sourceCode,old.bibliographyStatus==='unknown'?null:old.title,old.version,original.raw):old;rebuilt.set(s.id,s);put.run(JSON.stringify(s),s.id);
 }})();
 db.exec('DELETE FROM anchors;DELETE FROM translations;DELETE FROM explanations;');
 const anchor=db.prepare('INSERT OR IGNORE INTO anchors VALUES (?,?,?,?,?,?)'),translation=db.prepare('INSERT OR IGNORE INTO translations VALUES (?,?,?,?)'),explanation=db.prepare('INSERT INTO explanations VALUES (?,?)');
 let last='';for(;;){const rows=db.prepare('SELECT id,payload FROM articles WHERE id>? ORDER BY id LIMIT 200').all(last) as {id:string;payload:string}[];if(!rows.length)break;db.transaction(()=>{for(const r of rows){const a=JSON.parse(r.payload) as Article;
 if(scope){const allRefs=[...a.sources,...(a.relatedSources??[])];a.relatedSources=[];a.sources=allRefs.filter(ref=>{const status=scope(a,rebuilt.get(ref.id)!);if(!status){a.relatedSources!.push({...ref,mappingStatus:'proposed'});return false;}ref.mappingStatus=status;return true;});}
 const attested:{name:string;entryId:string}[]=[];
 for(const ref of a.sources){const source=rebuilt.get(ref.id)!;const row=heading.get(source.entryId) as {headers:string}|undefined;for(const h of row?JSON.parse(row.headers) as string[]:[]){if(h.endsWith(':'))continue;const value=h.replace(/_\d+$/,'');if(nameKey(value)===nameKey(a.originalName))attested.push({name:csCanonical(value),entryId:source.entryId});}}
 const preferred=attested.find(h=>h.name.includes('҆'))??attested[0];if(preferred){a.name=preferred.name;(a as Article&{displayOrthography:unknown}).displayOrthography={method:'source-attested',sourceEntryId:preferred.entryId};db.prepare('UPDATE articles SET name=?,payload=? WHERE id=?').run(a.name,JSON.stringify(a),a.id);}
 db.prepare('UPDATE articles SET payload=? WHERE id=?').run(JSON.stringify(a),a.id);
 for(const ref of a.sources){if(ref.mappingStatus!=='verified')continue;const s=rebuilt.get(ref.id)!;for(const x of s.anchors){anchor.run(x.id,a.id,s.id,x.text,x.translation,x.number);if(x.translation)for(const t of x.translation.split(';'))translation.run(russianKey(t),a.id,x.id,t.trim());}explanation.run(a.id,russianKey(s.text));}}})();last=rows.at(-1)!.id;}
 if(scope)db.prepare("INSERT INTO metadata(key,value) VALUES ('scopeChecked','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
 raw.close();
}
if(arg('--aliases-from')){
 const raw=new Database(arg('--aliases-from')!,{readonly:true,fileMustExist:true});raw.pragma('cache_size=-131072');
 const plan=JSON.parse(readFileSync(arg('--plan')!,'utf8')) as {links:{externalKey:string;candidateIds:string[]}[]};
 const recovery=JSON.parse(readFileSync(arg('--recovery')!,'utf8')) as {_id:string;externalKey:string}[];
 const owners=new Map(plan.links.map(l=>[l.externalKey,l.candidateIds]));for(const r of recovery)if(!owners.get(r.externalKey)?.length)owners.set(r.externalKey,[r._id]);
 const heading=raw.prepare('SELECT headers FROM entries WHERE id=?'),exists=db.prepare('SELECT 1 FROM articles WHERE id=?'),put=db.prepare('INSERT OR IGNORE INTO forms VALUES (?,?,?,?,?,?)');
 let batch:{target:string;form:string;analysis:string;sourceEntryId:string}[]=[];
 const save=db.transaction(()=>{for(const g of batch){const row=heading.get(g.sourceEntryId) as {headers:string}|undefined;if(!row)continue;for(const h of JSON.parse(row.headers) as string[]){const word=h.replace(/_\d+$/,'');if(!/^[\p{L}\p{M}]+$/u.test(word)||civilKey(word)===civilKey(g.form))continue;for(const id of owners.get(g.target)??[]){if(exists.get(id))put.run(civilKey(word),id,csCanonical(word),'Вариант написания из источника · '+g.analysis,'source-variant',2);}}}});
 for(const g of raw.prepare('SELECT target,form,analysis,sourceEntryId FROM grammar').iterate() as Iterable<typeof batch[number]>){batch.push(g);if(batch.length===1000){save();batch=[];}}if(batch.length)save();raw.close();
}
interface Decisions{relations?:Relation[];rejectedRelationIds?:string[];etymologies?:Record<string,EtymologyReference[]>}
const reviewed=arg('--decisions')?JSON.parse(readFileSync(arg('--decisions')!,'utf8')) as Decisions:{};
const proposed=arg('--proposals')?JSON.parse(readFileSync(arg('--proposals')!,'utf8')) as Decisions:{};
const relations=mergeRelations(proposed.relations??[],reviewed.relations??[],reviewed.rejectedRelationIds??[]);
const byOwner=new Map<string,Relation[]>();let dropped=0;
const getAnchor=db.prepare('SELECT text,sourceId FROM anchors WHERE id=? AND lexemeId=?');
for(const r of relations){
 const owner=r.id.split(':')[0];const source=getAnchor.get(r.anchorId,owner) as {text:string;sourceId:string}|undefined,target=getAnchor.get(r.targetAnchorId,r.targetId) as {text:string;sourceId:string}|undefined;
 if(!source||!target){if(r.status==='verified')throw Error('Reviewed relation lost its source anchor: '+r.id);dropped++;continue;}
 const targetName=(db.prepare('SELECT name FROM articles WHERE id=?').get(r.targetId) as {name:string}).name;
 const value={...r,targetName,anchorText:source.text.slice(0,300),targetAnchorText:target.text.slice(0,300),sourceId:source.sourceId,targetSourceId:target.sourceId};byOwner.set(owner,[...(byOwner.get(owner)??[]),value]);
}
const originDb=arg('--provenance')?new Database(arg('--provenance')!,{readonly:true,fileMustExist:true}):null;
const putArticle=db.prepare('UPDATE articles SET payload=? WHERE id=?');let last='';let linked=0,etymologies=0,verified=0;
for(;;){const rows=db.prepare('SELECT id,payload FROM articles WHERE id>? ORDER BY id LIMIT 200').all(last) as {id:string;payload:string}[];if(!rows.length)break;
 db.transaction(()=>{for(const r of rows){const a=JSON.parse(r.payload) as Article;
 if(['SPRO','NUM','NUMR'].includes(a.properties[0])&&!a.paradigms.some(p=>p.kind==='stored-case-forms')){const m=paradigmsFor({name:a.originalName,properties:a.properties.join(','),scheme:a.scheme,forms:a.extra.map(f=>({value:f.value,properties:f.grammar}))},a.id);a.paradigms=m.paradigms;a.extra=m.extra.map(f=>({value:f.value,grammar:f.properties,origin:'stored',segments:null}));}
 for(const p of a.paradigms)for(const slot of p.slots){slot.label=slotLabel(slot.id);for(const f of slot.forms){const church=toChurchSlavonic(f.value);if(f.segments&&f.segments.map(s=>s.text).join('')!==church)f.segments=null;f.value=church;}}
 for(const f of a.extra)f.value=toChurchSlavonic(f.value);
 if(originDb)attachOrigins(originDb,a);
 a.relations=byOwner.get(a.id)??[];a.etymologies=(reviewed.etymologies?.[a.id]??[]).filter(e=>e.status==='verified');linked+=a.relations.length;verified+=a.relations.filter(r=>r.status==='verified').length;etymologies+=a.etymologies.length;putArticle.run(JSON.stringify(a),a.id);}})();last=rows.at(-1)!.id;
}
const version=createHash('sha256').update(JSON.stringify({base:meta.version,scope:arg('--scope-sources')?hashFile(arg('--scope-sources')!):null,scopeCode:hashFile('src/lib/csDictionary/sourceScope.ts'),refresh:arg('--refresh-sources')?hashFile(arg('--refresh-sources')!):null,decisions:arg('--decisions')?hashFile(arg('--decisions')!):null,proposals:arg('--proposals')?hashFile(arg('--proposals')!):null,provenance:arg('--provenance')?hashFile(arg('--provenance')!):null,originsCode:hashFile('src/lib/csDictionary/origins.ts'),decisionsCode:hashFile('src/lib/csDictionary/decisions.ts'),parser:hashFile('src/lib/csDictionary/dsl.ts'),morphology:hashFile('src/lib/csDictionary/morphology.ts'),finalizer:hashFile('src/scripts/finalize-cs-publication.ts')})).digest('hex');
db.exec("INSERT INTO explanations(explanations) VALUES ('optimize')");db.prepare("UPDATE metadata SET value=? WHERE key='version'").run(version);db.prepare("UPDATE metadata SET value='complete' WHERE key='state'").run();db.pragma('wal_checkpoint(TRUNCATE)');db.pragma('journal_mode=DELETE');
originDb?.close();
const counts={articles:(db.prepare('SELECT count(*) n FROM articles').get() as {n:number}).n,forms:(db.prepare('SELECT count(*) n FROM forms').get() as {n:number}).n,sources:(db.prepare('SELECT count(*) n FROM sources').get() as {n:number}).n,relations:linked,verifiedRelations:verified,etymologies,droppedUnresolvedHypotheses:dropped};db.close();
const report={version,...counts,sha256:hashFile(out)};writeFileSync(out+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report,null,2));
