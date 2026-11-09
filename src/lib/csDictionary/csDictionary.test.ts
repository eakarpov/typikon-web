import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {parseDsl,sourceEntry,russianKey,safeTarget} from './dsl';
import {createPublication,DictionaryPublication,readableAnalysis} from './database';
import {segmentsFor,paradigmsFor,slotLabel} from './morphology';
import {buildLegacyView} from './legacyView';
import {mergeRelations} from './decisions';
import type {Relation} from './types';
import {decline} from '@/lib/morphology/decline';

test('source parser keeps emphasis, church script and inert hostile text without executable markup',()=>{
 const p=parseDsl('\t[m0][p]Св[/p] [c firebrick]сло́во[/c] — [i]речь[/i] [ref]глаго́лъ:[/ref] [url]javascript:alert(1)[/url] <script>evil</script>[/m]\n[s]vs.bmp[/s]');
 assert.equal(p.length,1);assert.ok(p[0].runs.some(r=>r.kind==='church'&&r.text==='сло́во'));assert.ok(p[0].runs.some(r=>r.target==='lookup:глаго́лъ'));assert.equal(safeTarget('javascript:alert(1)'),undefined);assert.equal(safeTarget('file:///etc/passwd'),undefined);assert.ok(!JSON.stringify(p).includes('vs.bmp'));assert.ok(JSON.stringify(p).includes('<script>'));
});
test('only source-marked numbering creates meanings; chapter numbers remain quotations',()=>{
 const raw='[m0][p]СЦРЯ[/p] [b]1)[/b] ▸ Отецъ. ◂ Мф. 3. 16. [b]2)[/b] ▸ Настоятель. ◂[/m]';const s=sourceEntry('f','e','СЦРЯ','Словарь','v',raw);
 assert.deepEqual(s.anchors.map(a=>a.number),['1','2']);assert.equal(s.anchors[0].translation,'Отецъ');assert.equal(s.anchors[1].translation,'Настоятель');
 const ordinary=sourceEntry('f','e','Св','Словарь','v','[m0]См. Пс. 3. 16.[/m]');assert.equal(ordinary.anchors.length,1);assert.equal(ordinary.anchors[0].status,'unsegmented');assert.equal(russianKey('Отѣцъ'),'отец');
});
test('segmentation reconstructs the exact surface and keeps clitic out of ending',()=>{
 const segments=segmentsFor('сло́вамиже',['сло́в'],'же');assert.ok(segments);assert.equal(segments.map(s=>s.text).join(''),'сло́вамиже');assert.equal(segments.at(-1)?.kind,'clitic');assert.equal(segments.find(s=>s.kind==='ending')?.text,'ами');assert.equal(segmentsFor('неизвестно',['друг']),null);assert.equal(segmentsFor('словами',['слов','слова']),null);
 assert.equal(slotLabel('aorDu23'),'Аорист · двойственное число · 2/3 лицо');
});
test('shared legacy view preserves stored forms and generator output, unknown scheme is not indeclinability',()=>{
 const row={name:'я́блоня',morphologyLemma:'я́блоня',properties:'S,f',scheme:'N3j',forms:[{value:'я́блони',properties:'sg,gen'}]};
 const view=buildLegacyView(row,'id');assert.equal(view.name,row.name);assert.ok(view.noun?.sgGen.some(f=>f.stored&&f.value==='я́блони'));assert.deepEqual(view.noun?.sgDat.filter(f=>!f.stored).map(f=>f.value),decline(row)?.sgDat);
 assert.equal(paradigmsFor({...row,scheme:'UNKNOWN'},'id').known,false);
});
function fixture(){const db=new Database(':memory:');createPublication(db);for(const [k,v] of Object.entries({state:'complete',scopeChecked:'1',format:'cs-publication-v1',version:'v'}))db.prepare('INSERT INTO metadata VALUES (?,?)').run(k,v);
 for(const [id,name] of [['a','а҆'],['b','бг҃ъ'],['c','сло́во'],['d','сло́во (омоним)']])db.prepare('INSERT INTO articles VALUES (?,?,?,?)').run(id,name,'noun','{}');
 for(const [key,id,surface,grammar,origin,rank] of [['а','a','а҆','','lemma',0],['бог','b','бг҃ъ','','lemma',0],['слова','c','сло́ва','родительный','stored-form',1],['слова','d','сло́ва','именительный','stored-form',1],['слово','c','сло́во','','lemma',0],['словом','c','сло́вом','творительный','generated-form',2]])db.prepare('INSERT INTO forms VALUES (?,?,?,?,?,?)').run(key,id,surface,grammar,origin,rank);
 db.prepare('INSERT INTO translations VALUES (?,?,?,?)').run('речь','c','anchor','речь');db.prepare('INSERT INTO explanations VALUES (?,?)').run('b','Упоминание слова речь в примере');db.prepare('INSERT INTO explanations VALUES (?,?)').run('b','Ещё речь');return {db,p:new DictionaryPublication(db)};}
test('search retains short words, homonyms, origin and pagination without duplicate explanation hits',()=>{
 const {db,p}=fixture();assert.equal(p.search('а','cu-ru').items[0].id,'a');assert.equal(p.search('слова','cu-ru').items.length,2);
 const first=p.search('сл','cu-ru',0,1);assert.ok(first.nextCursor);assert.equal(first.items[0].exact,false);assert.equal(p.search('слова','cu-ru').items[0].exact,true);const second=p.search('сл','cu-ru',Number(first.nextCursor),1);assert.notEqual(first.items[0].id,second.items[0].id);
 const ru=p.search('речь','ru-cu');assert.equal(ru.items[0].match,'translation');assert.equal(ru.items[1].match,'explanation');assert.equal(ru.items.length,2);assert.equal(p.search('неттакогослова','cu-ru').items.length,0);db.close();
});

test('plain source senses survive bible citations and pronouns keep attested paradigms',()=>{
 const s=sourceEntry('f','e','Дч','Словарь','v','[m0]1) народ (Пс. 43. 3.) 2) родство[/m]');
 assert.deepEqual(s.anchors.map(a=>a.number),['1','2']);
 const p=paradigmsFor({name:'азъ',properties:'SPRO',scheme:'',forms:[{value:'мене',properties:'sg,gen'},{value:'мне',properties:'sg,dat'}]},'id');
 assert.ok(p.paradigms.some(p=>p.slots.some(s=>s.forms.some(f=>f.value.includes('мене')))));
 assert.equal(p.known,false);
});

test('unnumbered blocks expose separate versioned equivalent fragments without bible citations',()=>{
 const s=sourceEntry('f','e','Св','Словарь','v','[m0]узник, колодник (Мф. 27, 15).[/m]');
 assert.equal(s.anchors[0].status,'unsegmented');assert.equal(s.anchors[0].translation,null);
 assert.equal(s.anchors[1].status,'source-fragment');assert.equal(s.anchors[1].translation,'узник; колодник');assert.equal(s.anchors[1].sourceVersion,'v');
 assert.equal(s.anchors[1].id,sourceEntry('f','e','Св','Словарь','v2','[m0]узник, колодник (Мф. 27, 15).[/m]').anchors[1].id);
});

test('repeated enrichment preserves accepted and rejected editorial decisions',()=>{
 const candidate:Relation={id:'owner:stable',type:'synonym',status:'proposed',targetId:'target',targetName:'word',anchorId:'fragment',targetAnchorId:'target-fragment',anchorText:'sense',basis:'automatic',provider:'ruwordnet',conceptIds:['concept']};
 const accepted={...candidate,status:'verified' as const,basis:'reviewed from source'};
 assert.deepEqual(mergeRelations([candidate],[accepted],[]),[accepted]);
 assert.deepEqual(mergeRelations([candidate],[],[candidate.id]),[]);
 assert.deepEqual(mergeRelations([candidate],mergeRelations([candidate],[accepted],[]),[]),[accepted]);
});

test('one-letter Russian equivalents are searchable, phrase headings remain explanations',()=>{
 assert.equal(sourceEntry('f','e','Св','Словарь','v','[m0]я.[/m]').anchors[1].translation,'я');
 assert.ok(sourceEntry('f','e','Св','Словарь','v','[m0]‹землѧ̀ бо́жїѧ› — Палестина, Обетованная Земля (Пс. 84, 2).[/m]').anchors.every(a=>a.translation===null));
});

test('separate equivalent fragments never combine disjoint passages into a meaning',()=>{
 const s=sourceEntry('f','e','СЦРЯ','Словарь','v','[m0]▸ Народъ. ◂ Пример. ▸ Родство. ◂[/m]');
 const fragments=s.anchors.filter(a=>a.status==='source-fragment');assert.deepEqual(fragments.map(a=>a.text),['Народъ','Родство']);assert.ok(fragments.every(a=>s.text.includes(a.text)));
});

test('search analyses prefer human labels over duplicate original tags',()=>{assert.equal(readableAnalysis('sg,gen/dat/loc / единственное число · родительный / единственное число · дательный / единственное число · местный'),'единственное число · родительный / единственное число · дательный / единственное число · местный');});

test('noun Nom slot is not mistaken for a neuter gender marker',()=>{assert.equal(slotLabel('sgNom'),'единственное число · именительный');assert.equal(slotLabel('sgNGen'),'единственное число · средний род · родительный');assert.equal(slotLabel('sgFNom'),'единственное число · женский род · именительный');});

test('relation view preserves meaning evidence and statuses without loading examples or forms',()=>{
 const {db,p}=fixture();
 const old=JSON.parse((db.prepare('SELECT payload FROM articles WHERE id=?').get('a') as {payload:string}).payload);
 const relations=[{id:'edge',type:'synonym',status:'proposed',anchorText:'meaning',targetId:'b',targetName:'other'}];
 db.prepare('UPDATE articles SET payload=? WHERE id=?').run(JSON.stringify({...old,relations,paradigms:[{large:'forms'}],sources:[{id:'missing',mappingStatus:'verified'}]}),'a');
 assert.deepEqual(p.relationView('a'),{id:old.id,name:old.name,pos:old.pos,relations});assert.equal(p.relationView('unknown'),null);db.close();
});
