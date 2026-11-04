import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createProvenance, provenanceWriter, formTargetId, schemeTargetId, matchLegacy, readProvenance, readProvenanceGraph, validateProvenance, type CsvWitness } from './provenance';

test('local scheme correction does not replace source code or match ambiguous homonyms',()=>{
 const c:CsvWitness={row:2,name:'па́ѵелъ',properties:'S',scheme:'N1t',forms:[{value:'па́ѵелъ',properties:'sg,nom'}]};
 const l={_id:'old-id',name:c.name,properties:c.properties,scheme:'N1t*',forms:c.forms as {value:string;properties:string}[]};
 const before=JSON.stringify(l);assert.equal(matchLegacy(l,[c]),c);assert.notEqual(schemeTargetId(l._id,l.scheme),schemeTargetId(l._id,c.scheme));
 assert.equal(matchLegacy(l,[c,{...c,row:3}]),undefined);assert.equal(JSON.stringify(l),before);
 assert.equal(matchLegacy({...l,name:'webmaster'},[{...c,name:'webmaster'}]),undefined);
});
test('form keys preserve spelling, grammatical ambiguity and owning lexeme',()=>{
 assert.notEqual(formTargetId('a','чꙋдо','sg'),formTargetId('a','чюдо','sg'));
 assert.notEqual(formTargetId('a','чюдо','sg'),formTargetId('a','чюдо','pl'));
 assert.notEqual(formTargetId('a','чюдо','sg'),formTargetId('b','чюдо','sg'));
});
test('multiple witnesses share a primary source but retain acquisition channels and proposed sense links',()=>{
 const db=new Database(':memory:');createProvenance(db);const w=provenanceWriter(db);
 w.target({id:'l',kind:'lexeme',scope:'current',lexemeId:'old-id',value:'слово'});
 w.target({id:'s',kind:'lexeme',scope:'source',value:'слово'});
 w.target({id:'definition',kind:'sense-candidate',scope:'source',parentId:'s',value:'unsegmented'});
 w.link('s','l','proposed',{method:'exact'});
 const base={targetId:'l',sourceId:'polyakov',origin:'dictionary',attribution:'exact-match',verifiedPrimarySourceId:'polyakov',locator:{row:2}} as const;
 w.evidence({...base,carrierVersionId:'csv'});w.evidence({...base,carrierVersionId:'csv'});
 w.evidence({...base,carrierVersionId:'chu',attribution:'reported'});
 w.evidence({targetId:'definition',carrierVersionId:'chu',sourceId:'unknown',origin:'unknown',attribution:'unknown',locator:{fragmentId:'f'},reason:'Unidentified source label'});
 const evidence=readProvenance(db,'old-id') as {carrierVersionId:string;verifiedPrimarySourceId?:string}[];
 assert.equal(evidence.length,3);assert.equal(new Set(evidence.filter(x=>x.verifiedPrimarySourceId).map(x=>x.verifiedPrimarySourceId)).size,1);
 assert.equal((db.prepare("SELECT count(*) n FROM targets WHERE kind='sense'").get() as {n:number}).n,0);db.close();
});
test('artifact validation refuses incomplete and stale plans',()=>{
 const db=new Database(':memory:');createProvenance(db);const plan={id:'p',sourceVersion:'sha',baseline:{fingerprint:'f'}};
 assert.throws(()=>validateProvenance(db,plan));
 for(const [k,v] of Object.entries({formatVersion:'1',state:'complete',planId:'p',baselineFingerprint:'f',chuRusSha256:'sha'}))db.prepare('INSERT INTO metadata VALUES (?,?)').run(k,v);
 validateProvenance(db,plan);assert.throws(()=>validateProvenance(db,{...plan,id:'changed'}));db.close();
});

test('source mapping does not pull in another candidate canonical article',()=>{
 const db=new Database(':memory:');createProvenance(db);const w=provenanceWriter(db);
 for(const id of ['first','second']){w.target({id,kind:'lexeme',scope:'current',lexemeId:id,value:id});w.evidence({targetId:id,sourceId:'unknown',carrierVersionId:'snapshot',origin:'unknown',attribution:'unknown',locator:{id}});}
 w.target({id:'source',kind:'lexeme',scope:'source',value:'ambiguous'});
 w.link('source','first','proposed',{});w.link('source','second','proposed',{});
 const graph=readProvenanceGraph(db,'first') as {targets:{id:string}[];links:{status:string}[]};
 assert.deepEqual(graph.targets.map(t=>t.id).sort(),['first','source']);assert.equal(graph.links.length,1);assert.equal(graph.links[0].status,'proposed');db.close();
});
