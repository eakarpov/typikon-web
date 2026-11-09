import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verseSelection} from './verseSelection';
test('dictionary range, old verse anchors and changing the anchor agree',()=>{
 assert.deepEqual(verseSelection('?highlight=16-18','#v16'),{first:16,last:18});
 assert.deepEqual(verseSelection('','#v16'),{first:16,last:16});
 assert.deepEqual(verseSelection('?highlight=16-18','#v23'),{first:23,last:23});
});
test('malformed and unbounded highlights are inert',()=>{
 for(const input of ['0','-1','18-16','NaN','1-1001','9999999999999999999999999'])assert.equal(verseSelection('?highlight='+input,''),null);
 assert.equal(verseSelection('','#v0'),null);
});
