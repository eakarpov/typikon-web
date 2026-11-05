import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {sourceEntry} from './dsl';
import {sourceExamples} from './examples';
import {createPublication,DictionaryPublication} from './database';
import type {Article} from './types';

test('examples require source-specific quotation plus an adjacent numeric citation',()=>{
 const make=(code:string,raw:string)=>sourceEntry('fragment','entry',code,'Словарь','source-v1',raw);
 const source=make('ГлтНЗ','[m0][i]Мф 3:16[/i] [c firebrick]крⷭ҇ти́всѧ І҆и҃съ[/c][/m]');
 const examples=sourceExamples(source);
 assert.equal(examples.length,1);assert.equal(examples[0].quote,'крⷭ҇ти́всѧ І҆и҃съ');assert.equal(examples[0].citation,'Мф 3:16');
 assert.equal(examples[0].sourceVersion,'source-v1');assert.equal(examples[0].sourceId,source.id);
 assert.deepEqual(sourceExamples(source),examples);
 assert.equal(sourceExamples(make('Св','[m0][i]Да возвратятся абие[/i] (Пс. 69, 4) — пояснение[/m]'))[0].script,'source');
 assert.equal(sourceExamples(make('Дч*','[m0][c firebrick]И абие[/c] (Марк. 1, 10)[/m]')).length,1);
 for(const [code,raw] of [
  ['Св','[m0][i]наречие[/i] — скоро[/m]'],
  ['Дч*','[m0][c firebrick]заголовок[/c] — объяснение (Мф. 3, 16)[/m]'],
  ['Дч*','[m0][c firebrick]цитата[/c] (Алф. Дух., гл. 2)[/m]'],
  ['СЦРЯ','[m0][i]русский пример[/i] (Мф. 3, 16)[/m]'],
 ])assert.deepEqual(sourceExamples(make(code,raw)),[]);
});

test('article examples exclude proposed and cross-referenced sources; stored editorial examples survive',()=>{
 const db=new Database(':memory:');createPublication(db);
 for(const [key,value] of Object.entries({state:'complete',scopeChecked:'1',format:'cs-publication-v1',version:'v'}))db.prepare('INSERT INTO metadata VALUES (?,?)').run(key,value);
 const refs=['own','ambiguous','cross'].map(id=>({id,title:'Словарь',sourceCode:'Св',preview:'',mappingStatus:id==='ambiguous'?'proposed' as const:'verified' as const}));
 for(const ref of refs){const source=sourceEntry(ref.id,'entry','Св','Словарь','v','[m0][i]Да возвратятся абие[/i] (Пс. 69, 4)[/m]');source.id=ref.id;db.prepare('INSERT INTO sources VALUES (?,?)').run(ref.id,JSON.stringify(source));}
 const a={id:'a',name:'а',extra:[],sources:refs.slice(0,2),relatedSources:[refs[2]]} as unknown as Article;
 db.prepare('INSERT INTO articles VALUES (?,?,?,?)').run('a','а','noun',JSON.stringify(a));
 const publication=new DictionaryPublication(db);assert.deepEqual(publication.article('a')?.examples?.map(e=>e.sourceId),['own']);
 a.examples=[];db.prepare('UPDATE articles SET payload=? WHERE id=?').run(JSON.stringify(a),'a');assert.deepEqual(publication.article('a')?.examples,[]);
 db.close();
});
