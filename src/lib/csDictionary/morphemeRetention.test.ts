import {it} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,linkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {morphemePublication,MorphemeError} from './morphemes';
it('retained versions resolve independently of the cached former active path on activation and rollback',()=>{
 const dir=mkdtempSync(join(tmpdir(),'morpheme-retention-'));const before=process.env.CS_MORPHEME_DB;
 const a='a'.repeat(64),b='b'.repeat(64);
 const activeA=join(dir,'active-a.sqlite'),activeB=join(dir,'active-b.sqlite');
 function create(path:string,version:string){
  const db=new Database(path);db.exec('CREATE TABLE metadata(key TEXT,value TEXT);CREATE TABLE morphemes(id TEXT,payload TEXT);');
  for(const [k,v] of Object.entries({format:'cs-morphemes-v1',state:'complete',version,dictionaryVersion:'D-'+version}))db.prepare('INSERT INTO metadata VALUES (?,?)').run(k,v);
  db.prepare('INSERT INTO morphemes VALUES (?,?)').run('root:X',JSON.stringify({id:'root:X',version}));db.close();
  linkSync(path,join(dir,`morphemes-${version}.sqlite`));
 }
 try{
  create(activeA,a);create(activeB,b);
  process.env.CS_MORPHEME_DB=activeA;assert.equal(morphemePublication().version,a);
  // Request A immediately after switching to B, before warming B in the cache.
  process.env.CS_MORPHEME_DB=activeB;const retainedA=morphemePublication(a);assert.equal(retainedA.version,a);assert.equal(retainedA.card('root:X')!.version,a);retainedA.db.close();
  assert.equal(morphemePublication().version,b);
  process.env.CS_MORPHEME_DB=activeA;const retainedB=morphemePublication(b);assert.equal(retainedB.version,b);retainedB.db.close();
  assert.equal(morphemePublication(a).version,a);
  assert.throws(()=>morphemePublication('c'.repeat(64)),MorphemeError);
  assert.equal(morphemePublication().version,a);
 }finally{
  if(before===undefined)delete process.env.CS_MORPHEME_DB;else process.env.CS_MORPHEME_DB=before;
  rmSync(dir,{recursive:true,force:true});
 }
});
