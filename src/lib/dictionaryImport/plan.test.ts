import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, assertCurrent, validatePlanId, fingerprint } from './plan';
import type { LegacyLexeme, RecoveryLexeme } from './model';
const old:LegacyLexeme[]=[{_id:'old',name:'па́ѵелъ',scheme:'LOCAL-FIX',properties:'S,m,anim',forms:[]}];
const fresh:RecoveryLexeme={_id:'123456789012345678901234',izvodId:'russian-synodal',externalKey:'я́кѡ:',name:'ꙗ҆́кѡ',search:'яко',scheme:'',properties:'CONJ',forms:[],morphologyStatus:'notApplicable',orthographyStatus:'source-attested',sourceEntryId:'entry',canonicalSourceEntryId:'entry'};
test('plan is additive and protects every existing field, not just IDs and schemes',()=>{
 const original=JSON.stringify(old),p=buildPlan(old,[fresh],[],'source','stage','recovery');validatePlanId(p);assertCurrent(p,old);
 assert.equal(p.insertions.length,1);assert.equal(JSON.stringify(old),original);
 assert.throws(()=>assertCurrent(p,[{...old[0],scheme:'new-local-edit'}]),/fresh plan/);
 assert.throws(()=>assertCurrent(p,[{...old[0],forms:[{value:'new',properties:''}]}]),/fresh plan/);
});
test('resume accepts only unedited rows owned by the same plan',()=>{
 const p=buildPlan(old,[fresh],[],'source','stage','recovery');
 assertCurrent(p,[...old,{...fresh,dictionaryImportPlanId:p.id}]);
 assert.throws(()=>assertCurrent(p,[...old,fresh]),/collision/);
 assert.throws(()=>assertCurrent(p,[...old,{...fresh,name:'edited',dictionaryImportPlanId:p.id}]),/edited/);
});
test('unresolved schemes and composition cannot silently enter the canonical collection',()=>{
 const p=buildPlan(old,[{...fresh,morphologyStatus:'unassigned'}],[],'s','s','s');assert.equal(p.insertions.length,0);assert.equal(p.held.length,1);
});
test('plan tampering is rejected and fingerprint is independent of object key order',()=>{
 const p=buildPlan(old,[fresh],[],'s','s','s');p.insertions[0].name='tampered';assert.throws(()=>validatePlanId(p),/checksum/);
 assert.equal(fingerprint(old),fingerprint([{properties:'S,m,anim',forms:[],scheme:'LOCAL-FIX',name:'па́ѵелъ',_id:'old'}]));
});
