import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,copyFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {createPublication} from './database';
import {csSearch,csArticle,csSource} from './http';
import {legacyArticle} from './profile';
import type {Article} from './types';
import Ajv from 'ajv';
import {csPaths,csSchemas} from './openapi';

const A='a'.repeat(64),B='b'.repeat(64),sid='f'.repeat(64),wid=(n:number)=>n.toString(16).padStart(24,'0');
function fixture(path:string,version:string){
 const db=new Database(path);createPublication(db);
 for(const [k,v] of Object.entries({format:'cs-publication-v1',state:'complete',scopeChecked:'1',version}))db.prepare('INSERT INTO metadata VALUES (?,?)').run(k,v);
 const source={id:sid,entryId:'native',sourceCode:'test',title:'Source',bibliographyStatus:'unknown',version:'source-revision',paragraphs:[],text:'text',anchors:[],examples:[]};
 db.prepare('INSERT INTO sources VALUES (?,?)').run(sid,JSON.stringify(source));
 for(let i=1;i<=4;i++){
  const article={id:wid(i),name:version[0]+i,originalName:'original',pos:'noun',properties:[],scheme:'',morphologyStatus:'unassigned',izvod:'',paradigms:[],extra:[{value:'а',origin:'stored',grammar:'',segments:null}],sources:[{id:sid,title:'Source',preview:'text',mappingStatus:'verified'}],relations:[],etymologies:[],usage:[],composition:[]};
  db.prepare('INSERT INTO articles VALUES (?,?,?,?)').run(wid(i),article.name,'noun',JSON.stringify(article));
  db.prepare('INSERT INTO forms VALUES (?,?,?,?,?,?)').run('аа'+i,wid(i),'а'+i,'','lemma',0);
 }db.close();
}
test('schema=2 pins all reads across activation/rollback; legacy stays available and deprecated',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'dictionary-profile-')),before=process.env.CS_DICTIONARY_DB,archive=process.env.CS_DICTIONARY_ARCHIVE_DIR;
 const url=(path:string,params:Record<string,string>={})=>new Request('https://example.test/api/v2/cs/'+path+'?'+new URLSearchParams(params));
 const read=async(params:Record<string,string>)=>csSearch(url('search',{q:'аа',limit:'2',schema:'2',...params}));
 try{
  const a=join(dir,`dictionary-${A}.sqlite`),b=join(dir,`dictionary-${B}.sqlite`);fixture(a,A);fixture(b,B);
  process.env.CS_DICTIONARY_DB=a;process.env.CS_DICTIONARY_ARCHIVE_DIR=dir;
  const first=await read({});assert.equal(first.status,200);const page=await first.json();assert.equal(page.dictionaryVersion,A);assert.equal(page.schemaVersion,2);assert.ok(page.nextCursor);
  process.env.CS_DICTIONARY_DB=b;
  const next=await read({version:A,cursor:page.nextCursor});assert.equal(next.status,200);const second=await next.json();assert.equal(second.dictionaryVersion,A);assert.deepEqual([...page.items,...second.items].map((x:{id:string})=>x.id),[1,2,3,4].map(wid));
  const article=await csArticle(url('lexemes/'+wid(1),{schema:'2',version:A}),wid(1));assert.equal(article.status,200);const body=await article.json();assert.equal(body.name,'a1');assert.equal(body.extra[0].formOrigin,'dictionary');assert.equal(body.extra[0].reviewStatus,'unknown');assert.equal(body.sources[0].sourceVersion,'source-revision');
  const source=await csSource(url('source-entries/'+sid,{schema:'2',version:A}),sid);const src=await source.json();assert.equal(src.dictionaryVersion,A);assert.equal(src.sourceVersion,'source-revision');assert.equal(src.version,'source-revision');
  const ajv=new Ajv({allErrors:true});
  for(const [name,value] of [['CsSearchV2',page],['CsArticleV2',body],['CsSourceV2',src]] as const){
   const validate=ajv.compile({$ref:`#/components/schemas/${name}`,components:{schemas:csSchemas}});assert.ok(validate(value),JSON.stringify(validate.errors));
  }
  assert.ok(csPaths['/api/v2/cs/search'].get.parameters.some(p=>p.name==='schema'));
  if(process.env.M104_WIRE_OUT)writeFileSync(process.env.M104_WIRE_OUT,JSON.stringify({search:page,continuation:second,article:body,source:src},null,2)+'\n');
  const relations=await csArticle(url('lexemes/'+wid(1),{schema:'2',version:A,view:'relations'}),wid(1));assert.equal((await relations.json()).dictionaryVersion,A);
  const invalidRequests:Record<string,string>[]=[{cursor:page.nextCursor},{version:B,cursor:page.nextCursor},{version:A,cursor:'2'},{version:A,cursor:page.nextCursor,limit:'1'},{version:A,cursor:page.nextCursor,q:'б'},{version:A,cursor:page.nextCursor,direction:'ru-cu'}];
  for(const bad of invalidRequests)assert.equal((await read(bad)).status,400);
  for(const method of [()=>read({version:'0'.repeat(64)}),()=>csArticle(url('x',{schema:'2',version:'../../bad'}),wid(1)),()=>csSource(url('x',{schema:'2',version:'0'.repeat(64)}),sid)])assert.equal((await method()).status,409);
  // A file with the requested name but another publication must not satisfy the pin.
  copyFileSync(b,join(dir,`dictionary-${'c'.repeat(64)}.sqlite`));assert.equal((await read({version:'c'.repeat(64)})).status,409);
  const legacy=await csSearch(url('search',{q:'аа',limit:'2'}));const old=await legacy.json();assert.equal(old.version,B);assert.equal(old.nextCursor,'2');assert.equal(old.schemaVersion,undefined);assert.equal(legacy.headers.get('X-Dictionary-Schema-Deprecated'),'true');assert.match(legacy.headers.get('Access-Control-Expose-Headers')!,/Link/);assert.equal(legacy.headers.get('Sunset'),null);
  const oldArticle=await csArticle(url('x',{version:A}),wid(1));const oldBody=await oldArticle.json();assert.equal(oldBody.name,'b1');assert.equal(oldBody.extra[0].formOrigin,undefined);assert.equal(oldBody.extra[0].origin,'stored');
  assert.equal((await read({schema:'99'})).status,400);
  process.env.CS_DICTIONARY_DB=a;assert.equal((await (await read({})).json()).dictionaryVersion,A);
  assert.equal((await csArticle(url('x',{schema:'2',version:A}),wid(99))).status,404);
 }finally{if(before===undefined)delete process.env.CS_DICTIONARY_DB;else process.env.CS_DICTIONARY_DB=before;if(archive===undefined)delete process.env.CS_DICTIONARY_ARCHIVE_DIR;else process.env.CS_DICTIONARY_ARCHIVE_DIR=archive;rmSync(dir,{recursive:true,force:true});}
});
test('legacy projection never fabricates stored/generated or verified for new origins/statuses',()=>{
 const a={extra:[{value:'known',origin:'stored'},{value:'text',formOrigin:'attested'},{value:'?',formOrigin:'unknown'}],paradigms:[],sources:[{id:'v',mappingStatus:'verified'},{id:'u',mappingStatus:'unknown'}]} as unknown as Article;
 const result=legacyArticle(a);assert.deepEqual(result.extra.map(f=>f.value),['known']);assert.deepEqual(result.sources.map(s=>s.id),['v']);
});
