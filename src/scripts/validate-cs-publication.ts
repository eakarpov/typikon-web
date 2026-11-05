/** Read-only acceptance checks against the actual legacy snapshot and published sources. */
import Database from 'better-sqlite3';
import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import type {LegacyLexeme} from '@/lib/dictionaryImport/model';
import {fingerprint} from '@/lib/dictionaryImport/plan';
import {DictionaryPublication} from '@/lib/csDictionary/database';
import type {Article,Direction} from '@/lib/csDictionary/types';
const arg=(key:string):string=>{const i=process.argv.indexOf(key);if(i<0||!process.argv[i+1])throw Error('Missing '+key);return process.argv[i+1];};
const db=new Database(arg('--publication'),{readonly:true,fileMustExist:true}),p=new DictionaryPublication(db);
const baseline=JSON.parse(readFileSync(arg('--snapshot'),'utf8')) as LegacyLexeme[];
const cases:{query:string;direction:Direction;expectedId:string}[]=[];
for(let i=0;i<baseline.length&&cases.length<360;i+=73){const l=baseline[i];if(!l.name||l.name==='webmaster')continue;cases.push({query:l.name,direction:'cu-ru',expectedId:l._id});const f=l.forms?.find(f=>f.value&&f.value!==l.name);if(f)cases.push({query:f.value,direction:'cu-ru',expectedId:l._id});}
const ru=db.prepare('SELECT key,min(lexemeId) id FROM translations WHERE length(key)>2 GROUP BY key HAVING count(DISTINCT lexemeId)=1 ORDER BY key').all() as {key:string;id:string}[];
for(let i=0;i<ru.length&&cases.length<480;i+=Math.max(1,Math.floor(ru.length/120)))cases.push({query:ru[i].key,direction:'ru-cu',expectedId:ru[i].id});
const times:number[]=[],failed:typeof cases=[];
for(const c of cases){const t=performance.now();const result=p.search(c.query,c.direction,0,50);times.push(performance.now()-t);if(!result.items.some(r=>r.id===c.expectedId))failed.push(c);}
let brokenSegments=0,orphanRelations=0,verifiedRelations=0,etymologies=0,unscopedRelations=0;
const originalById=new Map(baseline.filter(b=>b.name&&b.name!=='webmaster').map(b=>[b._id,b]));const missingLegacy=new Set(originalById.keys()),changedLocalFields:string[]=[];const sourceCache=new Map<string,Set<string>>();
const scoped=(sourceId:string,id:string):boolean=>{let ids=sourceCache.get(sourceId);if(!ids){const source=p.source(sourceId);ids=new Set(source?.anchors.filter(a=>a.status!=='unsegmented').map(a=>a.id)??[]);sourceCache.set(sourceId,ids);}return ids.has(id);};
const anchor=db.prepare('SELECT 1 FROM anchors WHERE id=? AND lexemeId=?');
for(const r of db.prepare('SELECT payload FROM articles').iterate() as Iterable<{payload:string}>){const a=JSON.parse(r.payload) as Article;const original=originalById.get(a.id);if(original){missingLegacy.delete(a.id);if(a.originalName!==original.name||a.scheme!==(original.scheme??'')||a.properties.join(',')!==(original.properties??'').split(',').filter(Boolean).join(','))changedLocalFields.push(a.id);}
for(const rel of a.relations){if(!anchor.get(rel.anchorId,a.id)||!anchor.get(rel.targetAnchorId,rel.targetId))orphanRelations++;if(!rel.sourceId||!rel.targetSourceId||!scoped(rel.sourceId,rel.anchorId)||!scoped(rel.targetSourceId,rel.targetAnchorId))unscopedRelations++;if(rel.status==='verified')verifiedRelations++;}etymologies+=a.etymologies.length;for(const paradigm of a.paradigms)for(const slot of paradigm.slots)for(const f of slot.forms)if(f.segments&&f.segments.map(s=>s.text).join('')!==f.value)brokenSegments++;}
const probes=['а','и','бог','земли','бг҃ъ'].map(query=>({query,results:p.search(query,'cu-ru',0,50).items.length}));
const missing=p.search('несуществующеесловоооо','cu-ru').items.length;
times.sort((a,b)=>a-b);const report={version:p.version,tested:cases.length,directions:{'cu-ru':cases.filter(c=>c.direction==='cu-ru').length,'ru-cu':cases.filter(c=>c.direction==='ru-cu').length},failed,p95LocalMs:times[Math.floor(times.length*.95)],baselineFingerprint:fingerprint(baseline),missingLegacy:[...missingLegacy],changedLocalFields,brokenSegments,orphanRelations,unscopedRelations,verifiedRelations,etymologies,probes,unknownWordResults:missing,cases};
writeFileSync(arg('--out'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,cases:undefined},null,2));db.close();if(failed.length||missingLegacy.size||changedLocalFields.length||brokenSegments||orphanRelations||unscopedRelations||missing)process.exitCode=1;
