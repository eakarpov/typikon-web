import {test} from 'node:test';
import assert from 'node:assert/strict';
import {removeGroupMembers,groupDeletionSettings} from './groupDeletion';
for(const remove of [false,true])test(`delete group / delete names=${remove}: isolate owner, retain other memberships, keep recovery`,async()=>{
 const docs:any[]=[{userId:'u',groups:['a','b'],name:'both'},{userId:'u',groups:['b'],name:'other'},{userId:'foreign',groups:['a'],name:'foreign'}];
 const store:any={updateMany:async(filter:any,update:any)=>{
  let modifiedCount=0;
  for(const doc of docs)if(doc.userId===filter.userId&&doc.groups.includes(filter.groups)&&(filter.deletedAt!==null||doc.deletedAt==null)) {
   if(update.$set)Object.assign(doc,update.$set);
   if(update.$pull)doc.groups=doc.groups.filter((g:string)=>g!==update.$pull.groups);
   modifiedCount++;
  }
  return {modifiedCount};
 }};
 const now=new Date('2026-11-14T00:00:00Z');
 assert.equal(await removeGroupMembers(store,'u','a',remove,now),remove?1:0);
 assert.deepEqual(docs[0].groups,['b']);assert.equal(Boolean(docs[0].deletedAt),remove);
 assert.equal(docs[1].deletedAt,undefined);assert.deepEqual(docs[2].groups,['a']);assert.equal(docs[2].deletedAt,undefined);
});
test('deleted group disables only its own selection and clears affected bookmark',()=>{
 const fields=groupDeletionSettings({commemorations:{one:{mode:'group',group:'a'},two:{mode:'group',group:'b'}},readingPlace:{personId:'1',group:''}},'a',['1']);
 assert.deepEqual(fields,{'commemorations.one':{mode:'none'},readingPlace:null});
});
