import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {attachOrigins} from './origins';
import type {Article} from './types';
test('origin projection never assigns an old scheme witness to a local correction',()=>{
 const db=new Database(':memory:');db.exec('CREATE TABLE targets(id TEXT,kind TEXT,payload TEXT,lexemeId TEXT,scope TEXT);CREATE TABLE evidence(targetId TEXT,payload TEXT,sourceId TEXT);CREATE TABLE sources(id TEXT,payload TEXT);');
 db.prepare('INSERT INTO sources VALUES (?,?)').run('legacy',JSON.stringify({title:'Исходный словарь'}));
 for(const [kind,value] of [['lexeme',{name:'слово'}],['scheme',{code:'N1t'}],['form',{value:'сло́ву'}]] as const){const id=kind+':word';db.prepare('INSERT INTO targets VALUES (?,?,?,?,?)').run(id,kind,JSON.stringify({id,value}),'word','current');db.prepare('INSERT INTO evidence VALUES (?,?,?)').run(id,JSON.stringify({sourceId:'legacy',origin:'dictionary',attribution:'exact-match',carrierVersionId:'version'}),'legacy');}
 const a={id:'word',scheme:'N1t*',extra:[{value:'сло́вꙋ',origin:'stored',grammar:'sg,dat',segments:null},{value:'слово',origin:'stored',grammar:'',segments:null}],paradigms:[]} as unknown as Article;
 attachOrigins(db,a);assert.equal(a.provenance?.lexeme[0].title,'Исходный словарь');assert.equal(a.provenance?.scheme[0].origin,'unknown');assert.equal(a.extra[0].provenance?.[0].sourceId,'legacy');assert.equal(a.extra[1].provenance?.[0].origin,'unknown');assert.deepEqual(db.prepare('SELECT count(*) n FROM targets').get(),{n:3});db.close();
});
