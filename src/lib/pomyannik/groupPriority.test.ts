import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderedGroups,validateGroupOrder,prioritizePersons,UNGROUPED} from './groupPriority';
import {readingPersons} from './reader';
const groups=[{id:'a',name:'Семья'},{id:'b',name:'Священство'},{id:'c',name:'Друзья'}];
test('group order validates ownership, duplicates and concurrent list changes',()=>{
 assert.deepEqual(validateGroupOrder(['b','a','c'],groups),['b','a','c']);
 for(const raw of [null,['a','a','c'],['a','b'],['a','b','foreign']])assert.throws(()=>validateGroupOrder(raw,groups));
 assert.deepEqual(orderedGroups(groups,['b','a']).map(g=>g.id),['b','a','c']);
});
test('highest matching group dominates name order without duplicating people',()=>{
 const people=[{id:'none',groups:[]},{id:'family',groups:['a']},{id:'both',groups:['a','b']},{id:'priest',groups:['b']},{id:'friend',groups:['c']}];
 const ordered=prioritizePersons(people,['b','a','c']);
 assert.deepEqual(ordered.map(p=>p.id),['both','priest','family','friend','none']);
 assert.equal(new Set(ordered.map(p=>p.id)).size,people.length);
 assert.deepEqual(people.map(p=>p.id),['none','family','both','priest','friend']);
});
test('ungrouped reading selects exactly people with no memberships',()=>{
 const people:any[]=[{id:'1',kind:'living',groups:[]},{id:'2',kind:'living',groups:['a']},{id:'3',kind:'departed',groups:[]}];
 assert.deepEqual(readingPersons(people,UNGROUPED,'all').map(p=>p.id),['1','3']);
 assert.deepEqual(readingPersons(people,UNGROUPED,'departed').map(p=>p.id),['3']);
});
