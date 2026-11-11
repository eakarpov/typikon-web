import Database from 'better-sqlite3';
import {validateMorphemeCard,legacyMorphemeCard} from '../lib/csDictionary/morphemeCard';
import assert from 'node:assert/strict';
const base=new Database(process.argv[2],{readonly:true}),next=new Database(process.argv[3],{readonly:true});let count=0;
for(const r of next.prepare('select id,payload from morphemes').all() as {id:string;payload:string}[]){const card=JSON.parse(r.payload);validateMorphemeCard(card,(id)=>!!next.prepare('select 1 from morphemes where id=?').get(id));const legacy=legacyMorphemeCard(card);const old=JSON.parse((base.prepare('select payload from morphemes where id=?').get(r.id) as {payload:string}).payload);delete old.version;delete legacy.version;assert.deepEqual(legacy,old,r.id);count++;}
console.log(JSON.stringify({checkedCards:count,canonicalValid:true,legacyRoundtripExact:true}));
