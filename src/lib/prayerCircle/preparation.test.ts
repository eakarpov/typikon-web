import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preparationSlot,dueInCycle} from './preparation';
test('preparation dates distribute readings while keeping service and prayers in order',()=>{
 const plan={date:'2026-11-02',days:3};
 assert.deepEqual([0,1,2].map(i=>preparationSlot(plan,'canon:'+i,i,3).date),['2026-10-30','2026-10-31','2026-11-01']);
 assert.deepEqual(preparationSlot(plan,'service',3,3),{date:'2026-11-01',part:'evening'});
 assert.deepEqual(preparationSlot(plan,'prayers',4,3),{date:'2026-11-02',part:'morning'});
 assert.deepEqual(preparationSlot(plan,'thanksgiving',5,3),{date:'2026-11-02',part:'day'});
 assert.equal(dueInCycle('2026-11-01','2026-11-02','morning'),true);
 assert.equal(dueInCycle('2026-11-02','2026-11-02','morning'),false);
});
test('zero and one day personal plans do not silently restore three days',()=>{
 assert.deepEqual(preparationSlot({date:'2026-11-02',days:0},'canon:0',0,3),{date:'2026-11-02',part:'morning'});
 assert.equal(preparationSlot({date:'2026-11-02',days:1},'canon:2',2,3).date,'2026-11-01');
});
