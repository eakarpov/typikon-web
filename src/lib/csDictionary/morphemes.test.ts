import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {MorphemePublication,MorphemeError} from './morphemes';

function fixture(){
 const db=new Database(':memory:');
 db.exec(`CREATE TABLE metadata(key TEXT,value TEXT);CREATE TABLE words(id TEXT,payload TEXT);CREATE TABLE morphemes(id TEXT,payload TEXT);
 CREATE TABLE morpheme_words(morpheme_id TEXT,sort_key TEXT,lexeme_id TEXT,payload TEXT,PRIMARY KEY(morpheme_id,sort_key,lexeme_id));`);
 for(const [k,v] of Object.entries({format:'cs-morphemes-v1',state:'complete',version:'a'.repeat(64),dictionaryVersion:'dict-v1'}))db.prepare('INSERT INTO metadata VALUES (?,?)').run(k,v);
 db.prepare('INSERT INTO words VALUES (?,?)').run('known',JSON.stringify({version:'a'.repeat(64),analyses:[]}));
 db.prepare('INSERT INTO morphemes VALUES (?,?)').run('root:X',JSON.stringify({statistics:{lexemes:5}}));
 for(let i=0;i<5;i++)db.prepare('INSERT INTO morpheme_words VALUES (?,?,?,?)').run('root:X','same-sort-key','word'+i,JSON.stringify({id:'word'+i}));
 return new MorphemePublication(db);
}
describe('morpheme publication',()=>{
 it('distinguishes known unassigned and unknown lexemes',()=>{
  const p=fixture();assert.deepEqual(p.word('known')?.analyses,[]);assert.equal(p.word('unknown'),null);p.db.close();
 });
 it('keyset pagination has no duplicates or gaps even with equal sort keys',()=>{
  const p=fixture();let cursor:string|null=null;const ids:string[]=[];
  do{const page:Record<string,unknown>=p.words('root:X',2,cursor)!;assert.equal(page.total,5);ids.push(...(page.items as {id:string}[]).map(w=>w.id));cursor=page.nextCursor as string|null;}while(cursor);
  assert.deepEqual(ids,['word0','word1','word2','word3','word4']);p.db.close();
 });
 it('rejects cursor reuse for another limit, morpheme or publication and nonexistent positions',()=>{
  const p=fixture(),cursor=p.words('root:X',2,null)!.nextCursor as string;
  assert.throws(()=>p.words('root:X',3,cursor),MorphemeError);
  for(const edit of [(v:unknown[])=>v[0]='wrong',(v:unknown[])=>v[1]='another',(v:unknown[])=>v[4]='missing']){
   const v=JSON.parse(Buffer.from(cursor,'base64url').toString()) as unknown[];edit(v);
   assert.throws(()=>p.words('root:X',2,Buffer.from(JSON.stringify(v)).toString('base64url')),MorphemeError);
  }
  for(const bad of ['', '%%%', 'e30', 'x'.repeat(5000)])assert.throws(()=>p.words('root:X',2,bad),MorphemeError);
  assert.equal(p.words('no-such-morpheme',2,null),null);p.db.close();
 });
 it('ETag is stable and depends on publication and complete URL',()=>{
  const p=fixture();assert.equal(p.etag('url'),p.etag('url'));assert.notEqual(p.etag('url'),p.etag('url?cursor=2'));p.db.close();
 });
});
