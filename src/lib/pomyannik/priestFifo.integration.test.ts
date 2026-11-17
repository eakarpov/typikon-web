import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createService,saveQueueSettings,slotsOf,startService,markQueued,advanceReadingPhase,finishService,enrichAssignment,dispatchWaiting,queueNotes} from './priestQueue';
const uri=process.env.TEST_MONGODB_URI;
test('submission and worker share FIFO backlog allocation',{skip:!uri},async t=>{
    assert.ok(['127.0.0.1','localhost'].includes(new URL(uri!).hostname));
    process.env.MONGODB_URI=uri;
    const client=await (await import('../mongodb')).default;
    const originalDb=client.db.bind(client),db=originalDb('priest_fifo_'+randomUUID().replaceAll('-',''));
    client.db=((name?:string,options?:any)=>name==='typikon-users'?db:originalDb(name,options)) as typeof client.db;
    const {sendNote}=await import('./zapiski');
    const now=new Date(),past=new Date(+now-300000),priest='fifo-priest';
    const settings={policyOnly:true,donationDetails:'',services:['proskomidia','panihida','moleben'].map(kind=>({kind,enabled:kind==='proskomidia',namesLimit:2,reminderEnabled:false,timeZone:'Europe/Moscow'}))};
    const submit=()=>sendNote('fifo-sender','','proskomidia',[{name:'Анна',kind:'living',sex:'f'}],{'Анна':{genitive:'А҆́нны',source:'lexicon'}},{targetUserId:priest});
    const service=()=>createService(db,priest,{kind:'proskomidia',startsAt:new Date(+now+3600000)},past);
    const fresh=async()=>{await db.dropDatabase();await db.collection('commemorators').insertOne({userId:priest,title:'Тест'});await saveQueueSettings(db,priest,settings,past);};
    try{
        await t.test('new submission cannot jump backlog; overflow automatically fills next service oldest first',async()=>{
            await fresh();const old=[];
            for(let i=0;i<3;i++){const n=await submit();old.push(n);await db.collection('zapiski').updateOne({_id:new (await import('mongodb')).ObjectId(n.id)},{$set:{createdAt:new Date(+now-60000+i)}});}
            const first=await service(),newest=await submit();
            assert.deepEqual((await slotsOf(db).findOne({_id:first}))!.entries.map(e=>e.noteId),old.slice(0,2).map(n=>n.id));
            for(const n of [old[2],newest]){const r=await enrichAssignment(db,n);assert.equal(r.queueStatus,'waiting');assert.equal(r.assignment,undefined);}
            assert.deepEqual((await queueNotes(db,(await slotsOf(db).findOne({_id:first}))!)).map(n=>n.id),old.slice(0,2).map(n=>n.id));
            await startService(db,priest,first,now,true);
            for(const n of old.slice(0,2))await markQueued(db,priest,n.id!,now,'living');
            await advanceReadingPhase(db,priest,first,now);await finishService(db,priest,first,now);
            const second=await service();assert.equal(await dispatchWaiting(db,now),2);
            assert.deepEqual((await slotsOf(db).findOne({_id:second}))!.entries.map(e=>e.noteId),[old[2].id,newest.id]);
            assert.equal((await enrichAssignment(db,old[2])).assignment?.serviceId,second);
            assert.equal((await db.collection('zapiski').findOne({fromUserId:'fifo-sender',readAt:null}))!.names[0].name,'Анна');
        });
        await t.test('worker fills existing backlog with no new submission and deterministic equal-time order',async()=>{
            await fresh();const old=[await submit(),await submit(),await submit()];
            await db.collection('zapiski').updateMany({},{$set:{createdAt:past}});
            const first=await service();await Promise.all([dispatchWaiting(db,now),dispatchWaiting(db,now)]);
            const expected=old.map(n=>n.id!).sort().slice(0,2);
            assert.deepEqual((await slotsOf(db).findOne({_id:first}))!.entries.map(e=>e.noteId),expected);
            assert.equal(await dispatchWaiting(db,now),0);
        });
        await t.test('parallel submissions and cron preserve priority of accumulated notes',async()=>{
            await fresh();const old=[await submit(),await submit()];const first=await service();
            await Promise.all([dispatchWaiting(db,now),...Array.from({length:12},()=>submit())]);await dispatchWaiting(db,now);
            const entries=(await slotsOf(db).findOne({_id:first}))!.entries;
            assert.deepEqual(entries.map(e=>e.noteId),old.map(n=>n.id));assert.equal(new Set(entries.map(e=>e.noteId)).size,2);
        });
        await t.test('live worker lease cannot be stolen; expired lease recovers after a crash',async()=>{
            await fresh();const oldest=await submit(),first=await service();
            const locks=db.collection('priestQueueDispatchLocks');await locks.insertOne({_id:'fifo' as any,owner:'other-process',until:new Date(Date.now()+120000)});
            await submit();assert.equal(await dispatchWaiting(db,now),0);assert.equal((await slotsOf(db).findOne({_id:first}))!.entries.length,0);
            assert.equal((await locks.findOne({_id:'fifo' as any}))!.owner,'other-process');
            await locks.updateOne({_id:'fifo' as any},{$set:{until:past}});assert.equal(await dispatchWaiting(db,now),2);
            assert.equal((await slotsOf(db).findOne({_id:first}))!.entries[0].noteId,oldest.id);assert.equal(await locks.countDocuments({}),0);
        });
    }finally{await db.dropDatabase();await client.close();}
});
