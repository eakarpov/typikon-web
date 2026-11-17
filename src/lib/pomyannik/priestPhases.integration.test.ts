import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MongoClient,ObjectId,type Db} from 'mongodb';
import {randomUUID} from 'node:crypto';
import {assignNote,slotsOf,ensureQueueIndexes,startService,markQueued,advanceReadingPhase,takeExtra,finishService,expireServices,queueNotes,enrichAssignment,dispatchWaiting} from './priestQueue';
import type {ServiceSlot} from './priestQueueRules';
const uri=process.env.TEST_MONGODB_URI;
test('two-stage priest commemoration with independent mixed-note parts',{skip:!uri},async t=>{
 const client=await new MongoClient(uri!).connect(),db=client.db('priest_phases_'+randomUUID().replaceAll('-','')),now=new Date();
 const fresh=async()=>{await db.dropDatabase();await ensureQueueIndexes(db);await db.collection('commemorators').insertMany([{userId:'p1',title:'Иерей 1'},{userId:'p2',title:'Иерей 2'}]);};
 const service=async(userId='p1',patch:Partial<ServiceSlot>={})=>{const s:ServiceSlot={_id:randomUUID(),userId,kind:'proskomidia',enabled:true,namesLimit:2,reminderEnabled:false,timeZone:'Europe/Moscow',startsAt:new Date(+now+3600000),readyAt:now,entries:[],revision:0,active:true,status:'scheduled',...patch};await slotsOf(db).insertOne(s);return s;};
 const note=async(kinds=['living','departed'],patch:any={})=>{const n={_id:new ObjectId(),fromUserId:'sender',toUserId:'',targetUserId:null,queueRequested:true,kind:'proskomidia',names:kinds.map((kind,i)=>({name:i?'Пётр':'Анна',slavonic:i?'Петра':'Анны',kind})),namesCount:kinds.length,readAt:null,sweptAt:null,createdAt:now,...patch};await db.collection('zapiski').insertOne(n);return n;};
 try{
  await t.test('mixed note reads separately, stage persists, retries keep timestamps and one-hour deadline',async()=>{
   await fresh();const s=await service(),n=await note();await assignNote(db,n,now);
   await startService(db,'p1',s._id,now,true);
   await assert.rejects(advanceReadingPhase(db,'p1',s._id,now),/Сначала/);
   await assert.rejects(takeExtra(db,'p1',s._id,now),/Сначала/);
   await assert.rejects(markQueued(db,'p1',String(n._id),now,'departed'),/другому этапу/);
   for(const forged of ['',null,0,'__proto__']) await assert.rejects(markQueued(db,'p1',String(n._id),now,forged as any),/Неверный этап/);
   await assert.rejects(markQueued(db,'p2',String(n._id),now,'living').then(ok=>{if(!ok)throw Error('forbidden');}),/forbidden/);
   assert.equal(await markQueued(db,'p1',String(n._id),now,'living'),true);
   let root=await db.collection('zapiski').findOne({_id:n._id});assert.equal(root?.readAt,null);assert.ok(root?.readParts.living);assert.equal(root?.readParts.departed,undefined);
   assert.equal((await enrichAssignment(db,n)).queueStatus,'partially-read');
   const cards=await queueNotes(db,(await slotsOf(db).findOne({_id:s._id}))!,true);assert.equal(cards.length,2);assert.ok(cards.find(c=>c.part==='living')?.readAt);assert.equal(cards.find(c=>c.part==='departed')?.readAt,null);
   await assert.rejects(finishService(db,'p1',s._id,now),/Сначала перейдите/);
   await advanceReadingPhase(db,'p1',s._id,new Date(+now+1000));await advanceReadingPhase(db,'p1',s._id,new Date(+now+2000));
   let loaded=await slotsOf(db).findOne({_id:s._id});assert.equal(loaded?.readingPhase,'departed');assert.equal(loaded?.readingMode,'batch');assert.equal(+loaded!.expiresAt!,+now+3600000);
   await markQueued(db,'p1',String(n._id),new Date(+now+3000),'living');root=await db.collection('zapiski').findOne({_id:n._id});assert.equal(+root!.readParts.living,+now);
   await markQueued(db,'p1',String(n._id),new Date(+now+4000),'departed');assert.equal((await enrichAssignment(db,n)).queueStatus,'read');
   await finishService(db,'p1',s._id,new Date(+now+5000));assert.equal((await queueNotes(db,(await slotsOf(db).findOne({_id:s._id}))!,true)).length,2);
  });
  await t.test('each stage separately opts into extras; a mixed extra never bypasses the second-stage offer',async()=>{
   await fresh();const s=await service(),base=await note(),extra=await note();await assignNote(db,base,now);assert.equal(await assignNote(db,extra,now),null);
   await startService(db,'p1',s._id,now,true);await markQueued(db,'p1',String(base._id),now,'living');
   assert.equal(await takeExtra(db,'p1',s._id,now),String(extra._id));
   assert.equal((await slotsOf(db).findOne({_id:s._id}))?.readingMode,'extra');
   await markQueued(db,'p1',String(extra._id),now,'living');await advanceReadingPhase(db,'p1',s._id,now);
   assert.equal((await slotsOf(db).findOne({_id:s._id}))?.readingMode,'batch');
   await assert.rejects(takeExtra(db,'p1',s._id,now),/Сначала помяните полученные/);
   await assert.rejects(markQueued(db,'p1',String(extra._id),now,'departed'),/Сначала выберите/);
   await markQueued(db,'p1',String(base._id),now,'departed');assert.equal(await takeExtra(db,'p1',s._id,now),String(extra._id));
   await markQueued(db,'p1',String(extra._id),now,'departed');await finishService(db,'p1',s._id,now);
   assert.equal((await enrichAssignment(db,extra)).queueStatus,'read');
  });
  await t.test('finish after living extra releases only its unread departed part and permits a later service',async()=>{
   await fresh();const s=await service(),base=await note(),extra=await note();await assignNote(db,base,now);
   await startService(db,'p1',s._id,now,true);await markQueued(db,'p1',String(base._id),now,'living');await takeExtra(db,'p1',s._id,now);await markQueued(db,'p1',String(extra._id),now,'living');
   await advanceReadingPhase(db,'p1',s._id,now);await markQueued(db,'p1',String(base._id),now,'departed');await finishService(db,'p1',s._id,now);
   const root=await db.collection('zapiski').findOne({_id:extra._id});assert.equal(root?.names.length,2);assert.equal(root?.namesCount,2);assert.equal(root?.readAt,null);
   const archived=(await queueNotes(db,(await slotsOf(db).findOne({_id:s._id}))!,true)).filter(n=>n.id===String(extra._id));assert.equal(archived.length,1);assert.equal(archived[0].part,'living');
   const receipt=await enrichAssignment(db,extra);assert.equal(receipt.partStatuses.find(p=>p.part==='living')?.queueStatus,'read');assert.equal(receipt.partStatuses.find(p=>p.part==='departed')?.queueStatus,'waiting');
   const next=await service('p2',{namesLimit:1});assert.equal((await assignNote(db,extra,now))?._id,next._id);
   const cards=await queueNotes(db,(await slotsOf(db).findOne({_id:next._id}))!,true);assert.equal(cards.length,1);assert.equal(cards[0].part,'departed');assert.equal(cards[0].namesCount,1);
   await startService(db,'p2',next._id,now,true);assert.equal((await slotsOf(db).findOne({_id:next._id}))?.readingPhase,'departed');
   await markQueued(db,'p2',String(extra._id),now,'departed');await finishService(db,'p2',next._id,now);assert.equal((await enrichAssignment(db,extra)).queueStatus,'read');
  });
  await t.test('one-hour expiry retains read living names and workers reassign departed only once',async()=>{
   await fresh();const s=await service(),n=await note();await assignNote(db,n,now);await startService(db,'p1',s._id,now,true);await markQueued(db,'p1',String(n._id),now,'living');
   await expireServices(db,new Date(+now+3600000));assert.equal((await slotsOf(db).findOne({_id:s._id}))?.status,'expired');
   const next=await service('p2',{startsAt:new Date(+now+7200000),namesLimit:1});
   await Promise.all([dispatchWaiting(db,new Date(+now+3600001)),dispatchWaiting(db,new Date(+now+3600001))]);
   assert.equal((await slotsOf(db).findOne({_id:next._id}))?.entries.length,1);assert.equal((await slotsOf(db).findOne({_id:next._id}))?.entries[0].namesCount,1);
   assert.equal((await queueNotes(db,(await slotsOf(db).findOne({_id:next._id}))!,true))[0].part,'departed');
  });
  await t.test('a crash after ledger read cannot release the reservation until the original read part is durable',async()=>{
   await fresh();const s=await service(),n=await note();await assignNote(db,n,now);await startService(db,'p1',s._id,now,true);
   let fail=true;const wrapped=new Proxy(db,{get(target,key){if(key==='collection')return(name:string)=>{const col=target.collection(name);if(name!=='zapiski')return col;return new Proxy(col,{get(c,k){if(k==='updateOne')return async(filter:any,...args:any[])=>{if(fail&&Object.hasOwn(filter,'readParts.living'))throw Error('simulated interrupted sync');return (c.updateOne as any)(filter,...args);};const v=Reflect.get(c,k);return typeof v==='function'?v.bind(c):v;}});};const v=Reflect.get(target,key);return typeof v==='function'?v.bind(target):v;}}) as Db;
   await assert.rejects(markQueued(wrapped,'p1',String(n._id),now,'living'),/interrupted sync/);
   await assert.rejects(finishService(wrapped,'p1',s._id,new Date(+now+3600000),true),/interrupted sync/);
   assert.ok((await slotsOf(db).findOne({_id:s._id}))?.entries.some(e=>e.noteId===String(n._id)));
   fail=false;await finishService(wrapped,'p1',s._id,new Date(+now+3600000),true);
   const next=await service('p2',{startsAt:new Date(+now+7200000),namesLimit:1});assert.equal((await assignNote(db,n,new Date(+now+3600001)))?._id,next._id);
   assert.equal((await queueNotes(db,(await slotsOf(db).findOne({_id:next._id}))!,true))[0].part,'departed');
  });
  await t.test('expired names keep partial confirmations and do not trap the service in living phase',async()=>{
   await fresh();const s=await service(),n=await note();await assignNote(db,n,now);await startService(db,'p1',s._id,now,true);await markQueued(db,'p1',String(n._id),now,'living');
   await db.collection('zapiski').updateOne({_id:n._id},{$set:{names:[],sweptAt:now}});
   const receipt=await enrichAssignment(db,n);assert.equal(receipt.partStatuses.length,2);assert.equal(receipt.partStatuses.find(p=>p.part==='living')?.queueStatus,'read');assert.equal(receipt.partStatuses.find(p=>p.part==='departed')?.queueStatus,'expired');
   await advanceReadingPhase(db,'p1',s._id,now);await finishService(db,'p1',s._id,now);
   assert.equal((await db.collection('zapiski').findOne({_id:n._id}))?.readAt,null);
   await fresh();const second=await service(),gone=await note();await assignNote(db,gone,now);await startService(db,'p1',second._id,now,true);await db.collection('zapiski').updateOne({_id:gone._id},{$set:{names:[],sweptAt:now}});
   await advanceReadingPhase(db,'p1',second._id,now);await finishService(db,'p1',second._id,now);assert.equal((await slotsOf(db).findOne({_id:second._id}))?.status,'finished');assert.equal((await db.collection('zapiski').findOne({_id:gone._id}))?.readAt,null);
  });
  await t.test('ledger metadata recovers confirmations if names expire before the first original-note sync',async()=>{
   await fresh();const s=await service(),n=await note();await assignNote(db,n,now);await startService(db,'p1',s._id,now,true);
   const current=await slotsOf(db).findOne({_id:s._id});const entry=current!.entries[0];entry.parts!.living!.readAt=now;
   await slotsOf(db).updateOne({_id:s._id},{$set:{entries:[entry]},$inc:{revision:1}});
   await db.collection('zapiski').updateOne({_id:n._id},{$set:{names:[],sweptAt:now}});
   await finishService(db,'p1',s._id,new Date(+now+3600000),true);
   const original=await db.collection('zapiski').findOne({_id:n._id});assert.deepEqual(original?.partCounts,{living:1,departed:1});assert.equal(original?.readAt,null);
   const receipt=await enrichAssignment(db,n);assert.equal(receipt.partStatuses.find(p=>p.part==='living')?.queueStatus,'read');assert.equal(receipt.partStatuses.find(p=>p.part==='departed')?.queueStatus,'expired');
  });
  await t.test('panihida and moleben have one phase; legacy mixed reading remains compatible',async()=>{
   await fresh();
   for(const [kind,phase] of [['panihida','departed'],['moleben','living']] as const){const s=await service('p1',{kind});const n=await note([phase],{kind});await assignNote(db,n,now);await startService(db,'p1',s._id,now,true);assert.equal((await slotsOf(db).findOne({_id:s._id}))?.readingPhase,phase);await assert.rejects(markQueued(db,'p1',String(n._id),now,phase==='living'?'departed':'living'),/другому этапу/);await assert.rejects(advanceReadingPhase(db,'p1',s._id,now),/нет второго этапа/);await markQueued(db,'p1',String(n._id),now,phase);await finishService(db,'p1',s._id,now);}
   const s=await service(),n=await note();await assignNote(db,n,now);await startService(db,'p1',s._id,now);await markQueued(db,'p1',String(n._id),now);assert.equal((await enrichAssignment(db,n)).queueStatus,'read');
  });
 }finally{await db.dropDatabase();await client.close();}
});
