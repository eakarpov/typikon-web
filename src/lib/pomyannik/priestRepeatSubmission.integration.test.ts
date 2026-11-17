import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createService,saveQueueSettings,slotsOf,startService,markQueued,finishService,enrichAssignment,dispatchWaiting} from './priestQueue';
const uri=process.env.TEST_MONGODB_URI;
test('real submissions wait through service editing window and automatically enter the next service',{skip:!uri},async()=>{
    // Dedicated local MongoDB only: sendNote uses the application's actual singleton.
    const url=new URL(uri!);assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
    process.env.MONGODB_URI=uri;
    const client=await (await import('../mongodb')).default;
    const {sendNote}=await import('./zapiski');
    const db=client.db('typikon-users'),prefix='repeat-'+randomUUID(),priest=prefix+'-priest',sender=prefix+'-sender';
    const now=new Date(),settings=(enabled:boolean)=>({policyOnly:true,donationDetails:'',services:['proskomidia','panihida','moleben'].map(kind=>({kind,enabled:kind==='proskomidia'&&enabled,namesLimit:30,reminderEnabled:false,timeZone:'Europe/Moscow'}))});
    try{
        await db.collection('commemorators').insertOne({userId:priest,title:'Иерей Тест'});
        await saveQueueSettings(db,priest,settings(true),new Date(+now-300000));
        const first=await createService(db,priest,{kind:'proskomidia',startsAt:new Date(+now+3600000)},now);
        const submit=()=>sendNote(sender,'','proskomidia',[{name:'Анна',kind:'living',sex:'f'}],{'Анна':{genitive:'А҆́нны',source:'lexicon'}},{targetUserId:priest});
        for (const kind of ['sorokoust','psaltir','god','polugodie'] as const) {
            await assert.rejects(sendNote(sender,'',kind,[{name:'Анна',kind:'departed',sex:'f'}],{}, {targetUserId:priest}),/только на проскомидию/);
        }
        assert.equal(await db.collection('zapiski').countDocuments({fromUserId:sender}),0);
        const n1=await submit();assert.equal((await enrichAssignment(db,n1)).queueStatus,'waiting');
        const firstReady=(await slotsOf(db).findOne({_id:first}))!.readyAt;
        await dispatchWaiting(db,firstReady);assert.equal((await enrichAssignment(db,n1)).assignment?.serviceId,first);
        await startService(db,priest,first,firstReady);await markQueued(db,priest,n1.id!,firstReady);await finishService(db,priest,first,firstReady);
        const secondDate=new Date(Date.now()+7200000);
        const second=await createService(db,priest,{kind:'proskomidia',startsAt:secondDate});
        const n2=await submit();let receipt=await enrichAssignment(db,n2);
        assert.equal(receipt.queueStatus,'waiting');
        assert.equal(receipt.assignment,undefined);
        const secondReady=(await slotsOf(db).findOne({_id:second}))!.readyAt;
        await dispatchWaiting(db,secondReady);
        receipt=await enrichAssignment(db,n2);
        assert.equal(receipt.queueStatus,'assigned');assert.equal(receipt.assignment?.serviceId,second);
        assert.equal(+receipt.assignment!.startsAt!,+secondDate);
        assert.equal((await slotsOf(db).findOne({_id:second}))?.entries.length,1);
        assert.equal(+(await slotsOf(db).findOne({_id:second}))!.readyAt,+secondReady);
        // No warm-up restart on harmless preference edits either.
        await saveQueueSettings(db,priest,settings(true));
        assert.equal(+(await slotsOf(db).findOne({_id:second}))!.readyAt,+secondReady);
        // Explicitly opting out and back in starts a new shared warm-up.
        await saveQueueSettings(db,priest,settings(false),now);
        await saveQueueSettings(db,priest,settings(true),now);
        const third=await createService(db,priest,{kind:'proskomidia',startsAt:new Date(+now+10800000)},new Date(+now+60000));
        assert.equal(+(await slotsOf(db).findOne({_id:third}))!.readyAt,+now+180000);
        assert.equal((await enrichAssignment(db,await submit())).queueStatus,'waiting');
    } finally{
        await slotsOf(db).deleteMany({userId:priest});await db.collection('commemorators').deleteMany({userId:priest});await db.collection('zapiski').deleteMany({fromUserId:sender});await client.close();
    }
});
