import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MongoClient, ObjectId} from 'mongodb';
import {insertWithinWeeklyQuota,weeklyQuota,saveWeeklyPolicy} from './weeklyQuota';
const uri=process.env.TEST_MONGODB_URI;
test('quota is shared, atomic, durable after sweeping, idempotent and resets on schedule',{skip:!uri},async()=>{
    assert.ok(['localhost','127.0.0.1'].includes(new URL(uri!).hostname));
    const client=await MongoClient.connect(uri!), db=client.db('quota_test_'+Date.now());
    const now=new Date('2026-11-16T12:00:00Z');
    const note=(count:number)=>({fromUserId:'user',toUserId:'priest',kind:'moleben',namesCount:count,names:[],createdAt:now});
    try {
        const results=await Promise.allSettled(Array.from({length:15},()=>insertWithinWeeklyQuota(db,note(2))));
        assert.equal(results.filter(r=>r.status==='fulfilled').length,10);
        assert.equal((await weeklyQuota(db,'user',now)).used,20);
        await assert.rejects(insertWithinWeeklyQuota(db,note(1)),/Недельный лимит/);
        assert.equal((await weeklyQuota(db,'other',now)).used,0);
        await saveWeeklyPolicy(db,{namesLimit:24,resetDay:7,resetHour:15,resetMinute:0},'admin');
        const submission={id:'abc',fingerprint:'same'};
        const first=await insertWithinWeeklyQuota(db,note(4),submission);
        const retry=await insertWithinWeeklyQuota(db,note(4),submission);
        assert.equal(String(first._id),String(retry._id));
        assert.equal((await weeklyQuota(db,'user',now)).used,24);
        await db.collection('zapiski').updateMany({},{$set:{names:[],sweptAt:now,readAt:now}});
        assert.equal((await weeklyQuota(db,'user',now)).used,24);
        await assert.rejects(insertWithinWeeklyQuota(db,note(1),{...submission,fingerprint:'different'}));
        const next=new Date('2026-11-22T12:00:00Z');
        assert.equal((await weeklyQuota(db,'user',next)).used,0);
        await insertWithinWeeklyQuota(db,{...note(24),createdAt:next});
        assert.equal((await weeklyQuota(db,'user',next)).used,24);
        await saveWeeklyPolicy(db,{namesLimit:10,resetDay:7,resetHour:15,resetMinute:0},'admin');
        await assert.rejects(insertWithinWeeklyQuota(db,{...note(1),createdAt:next}));
        // A process interrupted before insertion releases its expired reservation.
        const quota=await weeklyQuota(db,'orphan',now),key=`orphan:${quota.periodStart}`,id=new ObjectId();
        await db.collection<any>('pomyannikWeeklyUsage').insertOne({_id:key,used:10,pending:[{id,count:10,at:new Date(Date.now()-600000)}]});
        await insertWithinWeeklyQuota(db,{...note(10),fromUserId:'orphan'});
        assert.equal((await weeklyQuota(db,'orphan',now)).used,10);
        assert.equal((await db.collection<any>('pomyannikWeeklyUsage').findOne({_id:key}))!.used,10);
        // Initialisation imports history instead of resetting existing users to zero.
        await db.collection('zapiski').insertOne({...note(8),fromUserId:'existing'});
        await assert.rejects(insertWithinWeeklyQuota(db,{...note(3),fromUserId:'existing'}));
        await insertWithinWeeklyQuota(db,{...note(2),fromUserId:'existing'});
        assert.equal((await weeklyQuota(db,'existing',now)).used,10);
    } finally {await db.dropDatabase();await client.close();}
});
