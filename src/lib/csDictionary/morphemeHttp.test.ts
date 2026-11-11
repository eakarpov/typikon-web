import {it} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {csMorphemes,csOptions} from './morphemeHttp';
it('HTTP contract distinguishes empty analyses, invalid requests, unavailable publications and versions',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'morpheme-http-')),version='a'.repeat(64),wid='0'.repeat(24);
 const before={dict:process.env.CS_DICTIONARY_DB,morph:process.env.CS_MORPHEME_DB};
 try{
  const dict=new Database(join(dir,'dict.sqlite'));
  dict.exec('CREATE TABLE metadata(key TEXT,value TEXT)');
  for(const [k,v] of Object.entries({format:'cs-publication-v1',state:'complete',scopeChecked:'1',version:'dict-v1'}))dict.prepare('INSERT INTO metadata VALUES (?,?)').run(k,v);
  dict.close();
  const path=join(dir,`morphemes-${version}.sqlite`),db=new Database(path);
  db.exec(`CREATE TABLE metadata(key TEXT,value TEXT);CREATE TABLE words(id TEXT,payload TEXT);CREATE TABLE morphemes(id TEXT,payload TEXT);
   CREATE TABLE morpheme_words(morpheme_id TEXT,sort_key TEXT,lexeme_id TEXT,payload TEXT);`);
  for(const [k,v] of Object.entries({format:'cs-morphemes-v1',state:'complete',version,dictionaryVersion:'dict-v1'}))db.prepare('INSERT INTO metadata VALUES (?,?)').run(k,v);
  db.prepare('INSERT INTO words VALUES (?,?)').run(wid,JSON.stringify({version,lexemeId:wid,analyses:[]}));
  db.prepare('INSERT INTO morphemes VALUES (?,?)').run('root:X',JSON.stringify({version,id:'root:X'}));db.close();
  process.env.CS_DICTIONARY_DB=join(dir,'dict.sqlite');process.env.CS_MORPHEME_DB=path;
  const request=(q='')=>new Request('https://example.test/api/v2/cs/test'+q);
  const empty=await csMorphemes(request(),wid,'word');assert.equal(empty.status,200);assert.deepEqual((await empty.json()).analyses,[]);
  assert.equal(empty.headers.get('Access-Control-Allow-Origin'),'*');
  assert.equal((await csMorphemes(request(),'1'.repeat(24),'word')).status,404);
  assert.equal((await csMorphemes(request(),'../bad','word')).status,400);
  assert.equal((await csMorphemes(request(),'root:X','card')).status,400);
  for(const value of ['../../etc','b'.repeat(64)])assert.equal((await csMorphemes(request('?version='+value),'root:X','card')).status,409);
  for(const limit of ['0','101','1.5','NaN','-1',''])assert.equal((await csMorphemes(request(`?version=${version}&limit=${limit}`),'root:X','words')).status,400);
  const card=await csMorphemes(request(`?version=${version}`),'root:X','card');assert.equal(card.status,200);
  const conditional=new Request(request(`?version=${version}`),{headers:{'If-None-Match':card.headers.get('ETag')!}});
  assert.equal((await csMorphemes(conditional,'root:X','card')).status,304);
  const words=await csMorphemes(request(`?version=${version}&limit=20`),'root:X','words');assert.deepEqual((await words.json()).items,[]);
  assert.equal(csOptions().status,204);
  process.env.CS_MORPHEME_DB=join(dir,'missing.sqlite');assert.equal((await csMorphemes(request(),wid,'word')).status,503);
 }finally{
  if(before.dict===undefined)delete process.env.CS_DICTIONARY_DB;else process.env.CS_DICTIONARY_DB=before.dict;
  if(before.morph===undefined)delete process.env.CS_MORPHEME_DB;else process.env.CS_MORPHEME_DB=before.morph;
  rmSync(dir,{recursive:true,force:true});
 }
});
