import test from 'node:test';
import assert from 'node:assert/strict';
import { encliticComponent } from './composition';
test('ми links to the existing азъ article with the short dative analysis',()=>{
    const result=encliticComponent('ми',[{_id:'az-existing',name:'а́зъ',scheme:'PNja',properties:'SPRO',forms:[{value:'ми',properties:'sg,dat,clit'}]}]);
    assert.equal(result.lookupForm,'ми');assert.equal(result.lexemeId,'az-existing');assert.equal(result.lemma,'а́зъ');assert.equal(result.grammar,'sg,dat,clit');
});
test('ambiguous component analysis does not pick the first article',()=>{
    const rows=['one','two'].map(_id=>({_id,name:'же',scheme:'',properties:'PART',forms:[{value:'же',properties:''}]}));
    const result=encliticComponent('же',rows);assert.equal(result.lexemeId,null);assert.deepEqual(result.candidateIds,['one','two']);
});
