import {test} from 'node:test';
import assert from 'node:assert/strict';
import {personAge,effectiveStatusRank,rankSuitsSex,validateLifeDates} from './age';
import {effectiveRanks} from './marks';
test('7th and 14th birthdays change labels on the birthday itself',()=>{
 const boy={born:'2019-11-14',sex:'m',kind:'living'};
 assert.equal(personAge(boy,'2026-11-13'),6);
 assert.equal(effectiveStatusRank(boy,'2026-11-13'),'mladenets');
 assert.equal(effectiveStatusRank(boy,'2026-11-14'),'otrok');
 assert.equal(effectiveStatusRank(boy,'2033-11-13'),'otrok');
 assert.equal(effectiveStatusRank({...boy,rank:'otrok'},'2033-11-14'),null);
 assert.equal(effectiveStatusRank({...boy,sex:'f'},'2026-11-14'),'otrokovitsa');
 assert.equal(rankSuitsSex('otrok','f'),false);assert.equal(rankSuitsSex('otrokovitsa','m'),false);
});
test('departed age is frozen at death, manual labels without full dates remain available',()=>{
 const child={born:'2014-01-02',died:'2020-01-01',kind:'departed',sex:'f'};
 assert.equal(effectiveStatusRank(child,'2099-01-01'),'mladenets');
 assert.equal(effectiveStatusRank({...child,died:'2021-01-02'},'2099-01-01'),'otrokovitsa');
 assert.equal(effectiveStatusRank({rank:'otrok',sex:'m',kind:'departed'},'2026-11-14'),'otrok');
 assert.equal(effectiveStatusRank({rank:'mladenets',born:'2020',kind:'living'},'2026-11-14'),'mladenets');
 assert.throws(()=>validateLifeDates({...child,died:'2010-01-01'}),/раньше/);
 assert.throws(()=>validateLifeDates({kind:'departed',born:'2025',died:'2020'}),/раньше/);
 validateLifeDates(child);
});
test('age and temporary marks coexist and dated ages replace obsolete manual age labels',()=>{
 assert.deepEqual(effectiveRanks({born:'2015-01-01',rank:'mladenets',sex:'m',mark:'bolyashchiy',kind:'living'},'2026-11-14'),['otrok','bolyashchiy']);
 assert.deepEqual(effectiveRanks({born:'2015-01-01',rank:'mladenets',sex:'f',kind:'departed',died:'2026-11-01'},'2026-11-14'),['otrokovitsa','novoprestavlennyy']);
});
