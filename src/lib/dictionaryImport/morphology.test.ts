import test from 'node:test';
import assert from 'node:assert/strict';
import { decline, declineAdjective } from '@/lib/morphology/decline';
test('canonical church spelling and source grammar spelling remain separate',()=>{
 const name='ꙗ҆́блонѧ',morphologyLemma='я́блоня';
 assert.deepEqual(decline({name,morphologyLemma,scheme:'N3j',properties:'S,f,inan'}),decline({name:morphologyLemma,scheme:'N3j',properties:'S,f,inan'}));
 assert.deepEqual(declineAdjective({name:'ꙗ҆зы́ческїй',morphologyLemma:'язы́ческій',scheme:'A1k'}),declineAdjective({name:'язы́ческій',scheme:'A1k'}));
});
