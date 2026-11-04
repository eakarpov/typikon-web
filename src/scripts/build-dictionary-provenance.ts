/** Local, append-free build. Never connects to MongoDB and never modifies its inputs. */
import Database from 'better-sqlite3';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { createProvenance, provenanceWriter, provenanceId, lexemeTargetId, formTargetId, schemeTargetId, matchLegacy, type CsvWitness, type ProvenanceEvidence } from '@/lib/dictionaryImport/provenance';
import { fingerprint, stable, validatePlanId, type DictionaryImportPlan } from '@/lib/dictionaryImport/plan';
import { lemmaHeader } from '@/lib/dictionaryImport/core';
import type { LegacyLexeme, RecoveryLexeme, DslEntry } from '@/lib/dictionaryImport/model';
const arg=(name:string):string=>{const i=process.argv.indexOf(name);if(i<0||!process.argv[i+1]||process.argv[i+1].startsWith('--'))throw new Error(`Required ${name}`);return process.argv[i+1];};
const paths={snapshot:arg('--snapshot'),csv:arg('--csv'),staging:arg('--staging'),recovery:arg('--recovery'),review:arg('--review'),plan:arg('--plan')};
const out=arg('--out');if(existsSync(out))throw new Error('Refusing to overwrite an existing provenance artifact');
const hash=(file:string):string=>createHash('sha256').update(readFileSync(file)).digest('hex');
const hashes=Object.fromEntries(Object.entries(paths).map(([k,v])=>[k,hash(v)]));
const plan=JSON.parse(readFileSync(paths.plan,'utf8')) as DictionaryImportPlan;validatePlanId(plan);
const legacy=JSON.parse(readFileSync(paths.snapshot,'utf8')) as LegacyLexeme[];
const recovery=JSON.parse(readFileSync(paths.recovery,'utf8')) as RecoveryLexeme[];
if(fingerprint(legacy)!==plan.baseline.fingerprint||hashes.staging!==plan.stagingSha256||hashes.recovery!==plan.recoverySha256)throw new Error('Reviewed input mismatch');
const source=new Database(paths.staging,{readonly:true,fileMustExist:true});
const meta=Object.fromEntries((source.prepare('SELECT key,value FROM metadata').all() as {key:string;value:string}[]).map(r=>[r.key,r.value]));
if(meta.state!=='complete'||meta.structuredState!=='complete'||meta.sourceFileSha256!==plan.sourceVersion)throw new Error('Invalid Chu-Rus staging');
const db=new Database(out);createProvenance(db);db.pragma('journal_mode = WAL');db.pragma('synchronous = NORMAL');
const w=provenanceWriter(db);
const polyakov='work:polyakov-grammar',unknown='source:unknown',chu='compilation:chu-rus',old='import:legacy-csv',snapshot='snapshot:typikon',editor='editorial:recovery-review';
const src=(id:string,payload:unknown):void=>{db.prepare('INSERT OR IGNORE INTO sources VALUES (?,?)').run(id,stable({id,...payload as object}));};
const version=(sourceId:string,key:string):string=>{const id=provenanceId('version',[sourceId,hashes[key]]);db.prepare('INSERT INTO versions VALUES (?,?)').run(id,stable({id,sourceId,sha256:hashes[key],file:paths[key as keyof typeof paths]}));return id;};
src(polyakov,{kind:'dictionary',title:'А. Е. Поляков. Грамматический словарь церковнославянского языка',bibliographyStatus:'identified'});
src(unknown,{kind:'unknown',title:'Происхождение неизвестно',bibliographyStatus:'unknown'});
src(chu,{kind:'compilation',title:'Chu-Rus Reference v3',bibliographyStatus:'carrier-only'});
src(old,{kind:'import',title:'Исходный CSV typikon-web',reportedPrimarySourceId:polyakov});
src(snapshot,{kind:'snapshot',title:'Снимок словаря typikon-web'});src(editor,{kind:'editorial',title:'Редакторская проверка восстановления раздела я'});
const csvVersion=version(old,'csv'),snapshotVersion=version(snapshot,'snapshot'),reviewVersion=version(editor,'review');
const chuVersion=provenanceId('version',[chu,plan.sourceVersion]);
db.prepare('INSERT INTO versions VALUES (?,?)').run(chuVersion,stable({id:chuVersion,sourceId:chu,sha256:plan.sourceVersion,stagingSha256:hashes.staging,dslHeaders:JSON.parse(meta.dslHeaders??'[]')}));
const sourceIds=new Map<string,string>();
for(const s of source.prepare('SELECT * FROM sources').iterate() as Iterable<{code:string;title:string|null;url:string|null;rightsStatus:string}>){
 const id=s.code==='gr'?polyakov:`chu-label:${s.code}`;sourceIds.set(s.code,id);
 if(s.code!=='gr')src(id,{kind:s.code==='чс'?'reported-corpus':s.code==='article'?'structure':'dictionary',title:s.title??`Неустановленный источник: ${s.code}`,rawLabel:s.code,url:s.url,bibliographyStatus:s.title?'identified':'unknown',rightsStatus:s.rightsStatus});
}
const csvRows=parse(readFileSync(paths.csv),{relaxColumnCount:true}) as string[][];
const grouped=new Map<string,CsvWitness[]>();
csvRows.slice(1).forEach((r,i)=>{if(r.length<3||!r[1]||r[1]==='webmaster')return;const forms:CsvWitness['forms']=[];
 for(let j=3;j<r.length;j+=2)forms.push({value:r[j],...(j+1<r.length?{properties:r[j+1]}:{})});
 const c={row:i+2,name:r[1],properties:r[2],scheme:r[0],forms};const k=stable([c.name,c.properties]);grouped.set(k,[...(grouped.get(k)??[]),c]);});
const stats={legacyLexemes:legacy.length,matchedLegacy:0,unknownLegacy:0,changedSchemes:0,legacyFormSlots:0,preparedLexemes:recovery.length,sourceEntries:0,sourceForms:0,senseCandidates:0};
const oldEvidence=(targetId:string,c:CsvWitness|undefined,supported:boolean,locator:Record<string,unknown>):void=>{
 const e:ProvenanceEvidence={targetId,carrierVersionId:supported?csvVersion:snapshotVersion,sourceId:supported?polyakov:unknown,origin:supported?'dictionary':'unknown',attribution:supported?'exact-match':'unknown',locator,
 ...(supported?{verifiedPrimarySourceId:polyakov}:{reason:c?'Current value differs from the source CSV; local or other unattributed change':'No unique valid source CSV witness'})};w.evidence(e);
};
db.transaction(()=>{
 for(const l of legacy){const c=matchLegacy(l,grouped.get(stable([l.name,l.properties]))??[]),id=lexemeTargetId(l._id);stats[c?'matchedLegacy':'unknownLegacy']++;
 w.target({id,kind:'lexeme',scope:'current',lexemeId:l._id,value:{name:l.name,properties:l.properties}});oldEvidence(id,c,!!c,{row:c?.row,field:'name,properties',snapshotId:l._id});
 const scheme=w.target({id:schemeTargetId(id,l.scheme),kind:'scheme',scope:'current',lexemeId:l._id,parentId:id,value:{code:l.scheme,assignment:l.scheme?'assigned':'unassigned'}});
 oldEvidence(scheme,c,!!c&&c.scheme===l.scheme,{row:c?.row,column:1,snapshotId:l._id});
 if(c&&c.scheme!==l.scheme){stats.changedSchemes++;const historical=w.target({id:schemeTargetId(id,c.scheme),kind:'scheme',scope:'historical',lexemeId:l._id,parentId:id,value:{code:c.scheme}});oldEvidence(historical,c,true,{row:c.row,column:1});}
 (l.forms??[]).forEach((f,i)=>{stats.legacyFormSlots++;const form=w.target({id:formTargetId(id,f.value,f.properties),kind:'form',scope:'current',lexemeId:l._id,parentId:id,value:f});
 const slots=c?.forms.flatMap((a,j)=>stable(a)===stable(f)?[j]:[])??[];
 if(slots.length)for(const j of slots)oldEvidence(form,c,true,{row:c?.row,column:4+j*2,propertiesColumn:5+j*2});
 else oldEvidence(form,c,false,{snapshotId:l._id,slot:i});});
 }
})();
console.log('Legacy provenance complete');
const sourceRecord=(id:string):string=>`chu-record:${plan.sourceVersion}:${id}`;
const sourceLexeme=(key:string):string=>provenanceId('chu-lexeme',[plan.sourceVersion,key]);
const lemmaKeys=new Set<string>();
const batch=(table:string,fn:(row:Record<string,unknown>)=>void):void=>{let last=0;const q=source.prepare(`SELECT rowid,* FROM ${table} WHERE rowid>? ORDER BY rowid LIMIT 2000`);for(;;){const rows=q.all(last) as Record<string,unknown>[];if(!rows.length)break;db.transaction(()=>rows.forEach(fn))();last=Number(rows[rows.length-1].rowid);}};
batch('entries',r=>{const headers=JSON.parse(String(r.headers)) as string[],record=sourceRecord(String(r.id));stats.sourceEntries++;
 w.target({id:record,kind:'source-record',scope:'source',value:{entryId:r.id,headers,line:r.line,endLine:r.endLine}});
 w.evidence({targetId:record,carrierVersionId:chuVersion,sourceId:chu,origin:'unknown',attribution:'unknown',reason:'Compilation record; primary attribution is recorded separately per fragment',locator:{entryId:r.id,line:r.line}});
 const key=lemmaHeader({...r,headers} as unknown as DslEntry);if(key){lemmaKeys.add(key);const id=w.target({id:sourceLexeme(key),kind:'lexeme',scope:'source',value:{externalKey:key}});w.link(record,id,'proposed',{relation:'source-lemma-index'});
 w.evidence({targetId:id,carrierVersionId:chuVersion,sourceId:chu,reportedSourceId:polyakov,origin:'dictionary',attribution:'reported',locator:{entryId:r.id},reason:'Compiler lemma index; not proof of original Polyakov spelling'});}
});
const explanatory=new Set(['Дч','Дч*','Св','Сд','СЦРЯ','САР-1','Фл','Алекс','ГлтНЗ','od','Ник','РусXI-XVII']);
batch('fragments',r=>{const code=String(r.sourceCode),sid=sourceIds.get(code)??unknown;
 const candidate=explanatory.has(code),id=candidate?`sense-candidate:${plan.sourceVersion}:${String(r.id)}`:sourceRecord(String(r.entryId));
 if(candidate){stats.senseCandidates++;w.target({id,kind:'sense-candidate',scope:'source',parentId:sourceRecord(String(r.entryId)),value:{fragmentId:r.id,sourceCode:code,segmentation:'unreviewed-source-block'}});}
 w.evidence({targetId:id,carrierVersionId:chuVersion,sourceId:sid,reportedSourceId:sid,origin:code==='чс'?'reported-corpus':code==='article'?'unknown':'dictionary',attribution:code==='article'?'unknown':'reported',locator:{entryId:r.entryId,fragmentId:r.id,ordinal:r.ordinal,sourceCode:code},...(code==='article'?{reason:'Structural source block; primary origin unknown'}:{reason:'Source label reported by Chu-Rus; original edition not collated'})});
});
const freq=source.prepare('SELECT total FROM frequencies WHERE entryId=?');
batch('grammar',r=>{const parent=sourceLexeme(String(r.target));if(!lemmaKeys.has(String(r.target)))throw new Error(`Missing lemma index: ${String(r.target)}`);
 const id=w.target({id:formTargetId(parent,r.form,[r.properties,r.analysis]),kind:'form',scope:'source',parentId:parent,value:{value:r.form,properties:r.properties,analysis:r.analysis}});stats.sourceForms++;
 const f=freq.get(r.sourceEntryId) as {total:number|null}|undefined;
 w.evidence({targetId:id,carrierVersionId:chuVersion,sourceId:chu,reportedSourceId:polyakov,origin:f?.total&&f.total>0?'reported-corpus':'dictionary',attribution:'reported',locator:{entryId:r.sourceEntryId,sourceRow:r.rowid,frequency:f?.total??null},reason:'Compiler gr attribution; zero/unknown frequency does not attest corpus use'});
 w.link(sourceRecord(String(r.sourceEntryId)),parent,'proposed',{relation:'grammar-target',formId:id});
});
console.log('Chu-Rus source provenance complete');
db.transaction(()=>{
 for(const l of recovery){const id=w.target({id:lexemeTargetId(l._id),kind:'lexeme',scope:'prepared',lexemeId:l._id,value:{name:l.name,properties:l.properties,insertionPlanned:plan.insertions.some(x=>x._id===l._id)}});
 w.link(sourceLexeme(l.externalKey),id,'reviewed',{relation:'reviewed-recovery'});
 const reconstructed=l.orthographyStatus==='editorial-reviewed';
 w.evidence({targetId:id,carrierVersionId:reconstructed?reviewVersion:chuVersion,sourceId:reconstructed?editor:chu,origin:reconstructed?'editorial':'dictionary',attribution:reconstructed?'reconstructed':'reported',locator:{entryId:l.sourceEntryId,orthographyReview:l.orthographyReview}});
 for(const f of l.forms){const fid=w.target({id:formTargetId(id,f.value,f.properties),kind:'form',scope:'prepared',parentId:id,lexemeId:l._id,value:{value:f.value,properties:f.properties}});
 w.evidence({targetId:fid,carrierVersionId:chuVersion,sourceId:chu,reportedSourceId:polyakov,origin:f.evidenceKind==='source-reported-occurrence'?'reported-corpus':'dictionary',attribution:'reported',locator:{entryId:f.sourceEntryId,sourceForm:f.sourceForm,sourceProperties:f.sourceProperties,frequency:f.sourceFrequency??null,evidenceKind:f.evidenceKind},reason:'Chu-Rus evidence, not a typikon corpus occurrence'});}
 const sid=w.target({id:schemeTargetId(id,l.scheme),kind:'scheme',scope:'prepared',parentId:id,lexemeId:l._id,value:{code:l.scheme,status:l.morphologyStatus,evidence:l.schemeEvidence}});
 w.evidence({targetId:sid,carrierVersionId:l.schemeEvidence?reviewVersion:chuVersion,sourceId:l.schemeEvidence?editor:l.morphologyStatus==='notApplicable'?chu:unknown,origin:l.schemeEvidence?'editorial':l.morphologyStatus==='notApplicable'?'dictionary':'unknown',attribution:l.schemeEvidence?'reconstructed':l.morphologyStatus==='notApplicable'?'reported':'unknown',locator:{entryId:l.sourceEntryId,schemeEvidence:l.schemeEvidence},...(l.morphologyStatus==='unassigned'?{reason:'Scheme has not been established'}:{})});
 }
 for(const link of plan.links){const from=sourceLexeme(link.externalKey);for(const id of link.candidateIds)w.link(from,lexemeTargetId(id),'proposed',{method:link.method,selected:id===link.lexemeId});}
})();
// Prove graph integrity and byte-for-byte input preservation before sealing this artifact.
const missing=(db.prepare(`SELECT count(*) n FROM evidence e LEFT JOIN targets t ON t.id=e.targetId WHERE t.id IS NULL`).get() as {n:number}).n;
const orphans=(db.prepare(`SELECT count(*) n FROM links l LEFT JOIN targets a ON a.id=l.fromId LEFT JOIN targets b ON b.id=l.toId WHERE a.id IS NULL OR b.id IS NULL`).get() as {n:number}).n;
const parentOrphans=(db.prepare('SELECT count(*) n FROM targets t LEFT JOIN targets p ON t.parentId=p.id WHERE t.parentId IS NOT NULL AND p.id IS NULL').get() as {n:number}).n;
const unattested=(db.prepare('SELECT count(*) n FROM targets t LEFT JOIN evidence e ON e.targetId=t.id WHERE e.id IS NULL').get() as {n:number}).n;
if(parentOrphans||unattested)throw new Error(`Unaccounted targets: parents=${parentOrphans}, evidence=${unattested}`);
if(missing||orphans)throw new Error(`Dangling provenance: evidence=${missing}, links=${orphans}`);
for(const [k,p] of Object.entries(paths))if(hash(p)!==hashes[k])throw new Error(`Input changed during build: ${k}`);
const summary={...stats,targets:db.prepare('SELECT kind,scope,count(*) count FROM targets GROUP BY kind,scope').all(),evidence:db.prepare('SELECT origin,attribution,count(*) count FROM evidence GROUP BY origin,attribution').all(),unknownSourceLabels:source.prepare('SELECT code FROM sources WHERE title IS NULL').all(),inputHashes:hashes,baselineFingerprint:plan.baseline.fingerprint,planId:plan.id,canonicalDocumentsModified:0,canonicalSensesCreated:0,danglingEvidence:missing,danglingLinks:orphans,danglingParents:parentOrphans,targetsWithoutEvidence:unattested};
for(const [key,value] of Object.entries({formatVersion:'1',state:'complete',planId:plan.id,baselineFingerprint:plan.baseline.fingerprint,chuRusSha256:plan.sourceVersion,summary:JSON.stringify(summary)}))db.prepare('INSERT INTO metadata VALUES (?,?)').run(key,value);
db.pragma('wal_checkpoint(TRUNCATE)');db.pragma('journal_mode = DELETE');db.close();source.close();
writeFileSync(out+'.summary.json',JSON.stringify({...summary,artifactSha256:hash(out)},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(summary,null,2));
