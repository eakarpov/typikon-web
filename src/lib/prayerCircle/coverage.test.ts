import {test} from 'node:test';
import assert from 'node:assert/strict';
import {missingVerses} from './coverage';
test('partial Scripture cannot be reported as a complete requested passage',()=>{
 assert.deepEqual(missingVerses([1,2,4],1,4),[3]);
 assert.deepEqual(missingVerses([1,2,3],1,4),[4]);
 assert.deepEqual(missingVerses([1,2,3],4),[4]);
 assert.deepEqual(missingVerses([],1),[1]);
 const psalm=Array.from({length:176},(_,i)=>i+1);
 for(const [from,to] of [[1,72],[73,131],[132,176]])assert.deepEqual(missingVerses(psalm,from,to),[]);
});
