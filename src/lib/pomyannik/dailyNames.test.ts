import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dailyNames,cleanDailyNames} from './dailyNames';
import {selectCommemorationPersons,validateCommemorations} from './commemoration';
test('15 names / portions of 10: cyclic overlap, deterministic all day',()=>{
 const list=Array.from({length:15},(_,i)=>i+1),config={size:10,start:'2026-11-14'};
 assert.deepEqual(dailyNames(list,config,'2026-11-14'),[1,2,3,4,5,6,7,8,9,10]);
 assert.deepEqual(dailyNames(list,config,'2026-11-15'),[11,12,13,14,15,1,2,3,4,5]);
 assert.deepEqual(dailyNames(list,config,'2026-11-16'),[6,7,8,9,10,11,12,13,14,15]);
 assert.deepEqual(dailyNames(list,config,'2026-11-17'),dailyNames(list,config,'2026-11-14'));
 assert.deepEqual(dailyNames([1,2],config,'2026-11-15'),[1,2]);
 assert.deepEqual(dailyNames([],config,'2026-11-15'),[]);
 assert.deepEqual(dailyNames(list,undefined,'2026-11-15'),list);
});
test('select group and section before taking a portion; deleted names are excluded',()=>{
 const persons:any[]=[{id:'foreign-group',kind:'living',groups:['b']},...Array.from({length:15},(_,i)=>({id:String(i+1),kind:'living',groups:['a']})),{id:'departed',kind:'departed',groups:['a']},{id:'trash',kind:'living',groups:['a'],deletedAt:new Date()}];
 const choice={mode:'group' as const,group:'a',for:'living' as const,daily:{size:10,start:'2026-11-14'}};
 const portion=selectCommemorationPersons(persons,'morning-living',choice,'2026-11-15').map(p=>p.id);
 assert.deepEqual(portion,['11','12','13','14','15','1','2','3','4','5']);
 assert.equal(new Set(portion).size,10);
 assert.equal(validateCommemorations({'evening-living':choice})['evening-living']?.daily?.size,10);
 for(const daily of [{size:0,start:'2026-11-14'},{size:1001,start:'2026-11-14'},{size:2.5,start:'2026-11-14'},{size:10,start:'bad'}])assert.throws(()=>cleanDailyNames(daily));
});
