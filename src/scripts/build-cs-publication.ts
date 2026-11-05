import Database from 'better-sqlite3';
import {existsSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {hashFile} from '@/lib/dictionaryImport/files';
import {stable,fingerprint,type DictionaryImportPlan} from '@/lib/dictionaryImport/plan';
import {validatePlanId} from '@/lib/dictionaryImport/plan';
import {civilKey,csCanonical} from '@/lib/cslav/core';
import {toChurchSlavonic} from '@/lib/morphology/orthography';
import {partOfSpeech} from '@/lib/morphology/tags';
import {createPublication} from '@/lib/csDictionary/database';
import {sourceEntry,russianKey} from '@/lib/csDictionary/dsl';
import {paradigmsFor} from '@/lib/csDictionary/morphology';
import type {Article,SourceEntry,Relation,EtymologyReference} from '@/lib/csDictionary/types';
import type {LegacyLexeme,RecoveryLexeme,DslEntry} from '@/lib/dictionaryImport/model';
import {references} from '@/lib/dictionaryImport/core';
const opt=(k:string):string|undefined=>{const i=process.argv.indexOf(k);return i<0?undefined:process.argv[i+1];};
const req=(k:string):string=>{const x=opt(k);if(!x||x.startsWith('--'))throw Error('Required '+k);return x;};
const snapshot=req('--snapshot'),staging=req('--staging'),planPath=req('--plan'),recoveryPath=req('--recovery'),out=req('--out');
if(existsSync(out))throw Error('Output already exists');
const plan=JSON.parse(readFileSync(planPath,'utf8')) as DictionaryImportPlan;validatePlanId(plan);
const baseline=JSON.parse(readFileSync(snapshot,'utf8')) as LegacyLexeme[];
if(fingerprint(baseline)!==plan.baseline.fingerprint||hashFile(staging)!==plan.stagingSha256||hashFile(recoveryPath)!==plan.recoverySha256)throw Error('Reviewed inputs changed');
const recovery=JSON.parse(readFileSync(recoveryPath,'utf8')) as RecoveryLexeme[];
interface Decisions {rejectedRelationIds?:string[];relations?:Relation[];etymologies?:Record<string,EtymologyReference[]>;usage?:Record<string,Article['usage']>}
const decisions=opt('--decisions')?JSON.parse(readFileSync(opt('--decisions')!,'utf8')) as Decisions:{};
const proposals=opt('--proposals')?JSON.parse(readFileSync(opt('--proposals')!,'utf8')) as Decisions:{};
const rejected=new Set(decisions.rejectedRelationIds??[]);
const relationMap=new Map((proposals.relations??[]).filter(r=>r.status==='proposed'&&!rejected.has(r.id)).map(r=>[r.id,r]));
for(const r of decisions.relations??[])relationMap.set(r.id,r);
const relations=[...relationMap.values()];
const hash=(s:string):string=>createHash('sha256').update(s).digest('hex');
const snapshotHash=hashFile(snapshot);
const codeHash=hash(['src/scripts/build-cs-publication.ts',...readdirSync('src/lib/csDictionary').filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).map(f=>'src/lib/csDictionary/'+f),...readdirSync('src/lib/morphology').filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).map(f=>'src/lib/morphology/'+f)].map(file=>hashFile(file)).join('')); 
const version=hash(stable({format:'cs-publication-v1',codeHash,source:plan.sourceVersion,baseline:plan.baseline,recovery:plan.recoverySha256,decisions,proposalsHash:opt('--proposals')?hashFile(opt('--proposals')!):null}));
const source=new Database(staging,{readonly:true,fileMustExist:true}),db=new Database(out);createPublication(db);db.pragma('journal_mode=WAL');db.pragma('synchronous=NORMAL');
const putArticle=db.prepare('INSERT INTO articles VALUES (?,?,?,?)'),putSource=db.prepare('INSERT OR IGNORE INTO sources VALUES (?,?)'),putForm=db.prepare('INSERT OR IGNORE INTO forms VALUES (?,?,?,?,?,?)');
const putAnchor=db.prepare('INSERT OR IGNORE INTO anchors VALUES (?,?,?,?,?,?)'),putTranslation=db.prepare('INSERT OR IGNORE INTO translations VALUES (?,?,?,?)'),putExplanation=db.prepare('INSERT INTO explanations VALUES (?,?)');
const entry=source.prepare('SELECT id,headers,body,line,endLine FROM entries WHERE id=?'),fragments=source.prepare("SELECT * FROM fragments WHERE entryId=? AND sourceCode NOT IN ('article','gr','чс')");
const codes=new Map((source.prepare('SELECT code,title FROM sources').all() as {code:string;title:string|null}[]).map(r=>[r.code,r.title]));
const heads=new Map<string,string>();for(const row of source.prepare('SELECT id,headers FROM entries').iterate() as Iterable<{id:string;headers:string}>){for(const h of JSON.parse(row.headers) as string[])heads.set(h,row.id);}
const formsByTarget=new Map<string,string[]>();for(const g of source.prepare('SELECT target,sourceEntryId FROM grammar').iterate() as Iterable<{target:string;sourceEntryId:string}>){const a=formsByTarget.get(g.target)??[];a.push(g.sourceEntryId);formsByTarget.set(g.target,a);}
const links=new Map<string,typeof plan.links[number][]>();for(const link of plan.links)for(const id of link.candidateIds){const a=links.get(id)??[];a.push(link);links.set(id,a);}
const originalIds=new Set(baseline.map(l=>l._id));
// A publication can expose a reviewed heading without inventing a missing paradigm.
const rows=[...baseline,...recovery.filter(r=>!originalIds.has(r._id)&&['source-attested','editorial-reviewed'].includes(r.orthographyStatus))];
let count=0,forms=0,sourceCount=0,anchors=0;const hidden:string[]=[];
for(let at=0;at<rows.length;at+=200){db.transaction(()=>{for(const row of rows.slice(at,at+200)){
 if(!row.name||row.name==='webmaster'){hidden.push(row._id);continue;}
 const recoveryRow=row as RecoveryLexeme;const related=links.get(row._id)??[];
 if(recoveryRow.externalKey&&!related.length)related.push({externalKey:recoveryRow.externalKey,lexemeId:row._id,candidateIds:[row._id],method:'exact',reviewStatus:'proposed'});
 const entryIds=new Set<string>();const matchedForms:{value:string;properties:string;sourceEntryId:string}[]=[];
 for(const l of related){const lemmaId=heads.get(l.externalKey);if(lemmaId){entryIds.add(lemmaId);const e=entry.get(lemmaId) as DslEntry&{headers:string};for(const ref of references(e.body)){const id=heads.get(ref);if(id)entryIds.add(id);}}
  for(const id of formsByTarget.get(l.externalKey)??[])entryIds.add(id);
 }
 const sourceItems:SourceEntry[]=[];const sourceSeen=new Set<string>();
 for(const eid of entryIds){for(const f of fragments.all(eid) as {id:string;entryId:string;sourceCode:string;raw:string}[]){
  const key=hash(f.sourceCode+'\0'+f.raw);if(sourceSeen.has(key))continue;sourceSeen.add(key);
  const se=sourceEntry(f.id,f.entryId,f.sourceCode,codes.get(f.sourceCode)??null,plan.sourceVersion,f.raw);if(se.text.trim())sourceItems.push(se);
 }}
 for(const l of related){for(const g of source.prepare('SELECT form,analysis,sourceEntryId FROM grammar WHERE target=?').all(l.externalKey) as {form:string;analysis:string;sourceEntryId:string}[])matchedForms.push({value:g.form,properties:g.analysis===':'?'':g.analysis,sourceEntryId:g.sourceEntryId});}
 const merged={...row,forms:[...(row.forms??[]),...matchedForms]};
 const morph=paradigmsFor(merged,row._id);const name=toChurchSlavonic(row.name);const pos=partOfSpeech(row.properties??'');
 const article:Article={id:row._id,name,originalName:row.name,properties:(row.properties??'').split(',').filter(Boolean),pos,scheme:row.scheme??'',morphologyStatus:morph.known?'supported':['ADV','ADVPRO','CONJ','PART','PR','INTJ','PRED'].includes((row.properties??'').split(',')[0])?'notApplicable':'unassigned',izvod:'russian-synodal',paradigms:morph.paradigms,extra:morph.extra.map(f=>({value:csCanonical(f.value),origin:'stored',grammar:f.properties,segments:null})),sources:sourceItems.map(s=>({id:s.id,title:s.title,sourceCode:s.sourceCode,preview:s.text.slice(0,220),mappingStatus:related.some(l=>l.method==='exact'||l.method==='verified-orthography')?'verified':'proposed'})),relations:relations.filter(r=>r.id&&r.anchorId&&r.targetId!==row._id&&r.id.startsWith(row._id+':')),etymologies:(decisions.etymologies?.[row._id]??[]).filter(e=>e.status==='verified'),usage:decisions.usage?.[row._id]??[],composition:(recoveryRow.composition?.components??[]).map(c=>({role:c.role,form:c.lookupForm,lexemeId:c.lexemeId,candidateIds:c.candidateIds}))};
 putArticle.run(row._id,name,pos,JSON.stringify(article));count++;
 const indexForm=(value:string,grammar:string,origin:string,rank:number):void=>{const key=civilKey(value);if(!key)return;forms+=putForm.run(key,row._id,csCanonical(value),grammar,origin,rank).changes;};
 indexForm(row.name,'','lemma',0);indexForm(name,'','lemma',0);if(row.search)indexForm(row.search,'','lemma',0);
 for(const f of merged.forms)indexForm(f.value,f.properties??'','stored-form',1);
 for(const f of matchedForms){const e=entry.get(f.sourceEntryId) as {headers:string}|undefined;for(const h of e?JSON.parse(e.headers) as string[]:[]){const word=h.replace(/_\d+$/,'');if(/^[\p{L}\p{M}]+$/u.test(word)&&civilKey(word)!==civilKey(f.value))indexForm(word,'Вариант написания в источнике · '+f.properties,'source-variant',2);}}
 for(const p of article.paradigms)for(const slot of p.slots)for(const f of slot.forms)indexForm(f.value,slot.label,f.origin==='stored'?'stored-form':'generated-form',f.origin==='stored'?1:2);
 for(const s of sourceItems){sourceCount+=putSource.run(s.id,JSON.stringify(s)).changes;
  for(const a of s.anchors){anchors+=putAnchor.run(a.id,row._id,a.sourceId,a.text,a.translation,a.number).changes;if(a.translation)for(const t of a.translation.split(';')){const k=russianKey(t);if(k)putTranslation.run(k,row._id,a.id,t.trim());}}
  putExplanation.run(row._id,russianKey(s.text));
 }
 }} )();if(at%2000===0)console.log(JSON.stringify({processed:at,articles:count,forms,sourceCount}));}
for(const [k,v] of Object.entries({format:'cs-publication-v1',version,state:'complete',sourceVersion:plan.sourceVersion,baselineFingerprint:plan.baseline.fingerprint,counts:JSON.stringify({articles:count,forms,sources:sourceCount,anchors,hidden})}))db.prepare('INSERT INTO metadata VALUES (?,?)').run(k,v);
db.exec("INSERT INTO explanations(explanations) VALUES ('optimize')");db.pragma('wal_checkpoint(TRUNCATE)');db.pragma('journal_mode=DELETE');db.close();source.close();
const summary={version,articles:count,forms,sources:sourceCount,anchors,hidden,baselineUnmodified:hashFile(snapshot)===snapshotHash,sha256:hashFile(out)};writeFileSync(out+'.json',JSON.stringify(summary,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(summary,null,2));
