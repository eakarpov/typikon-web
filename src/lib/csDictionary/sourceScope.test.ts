import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {sourceScoper} from './sourceScope';
import type {Article,SourceEntry} from './types';
test('cross references are not definitions; ambiguous ownership stays proposed',()=>{
 const db=new Database(':memory:');db.exec('CREATE TABLE entries(id TEXT,headers TEXT);CREATE TABLE grammar(sourceEntryId TEXT,target TEXT);');
 for(const [id,headers] of [['own',['сло́во']],['other',['глаго́лъ']],['form',['слове́съ']],['ambiguous',['миръ']]] as const)db.prepare('INSERT INTO entries VALUES (?,?)').run(id,JSON.stringify(headers));
 db.prepare('INSERT INTO grammar VALUES (?,?)').run('form','сло́во:');
 const scope=sourceScoper(db,[{externalKey:'сло́во:',candidateIds:['word'],method:'exact'},{externalKey:'миръ:',candidateIds:['peace','world'],method:'exact'}],[]);
 const article={id:'word'} as Article,source=(entryId:string)=>({entryId} as SourceEntry);
 assert.equal(scope(article,source('own')),'verified');assert.equal(scope(article,source('form')),'verified');assert.equal(scope(article,source('other')),null);assert.equal(scope({id:'peace'} as Article,source('ambiguous')),'proposed');db.close();
});
