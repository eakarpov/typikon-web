import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { listPriests, updatePriestIdentity } from './priestAdmin';
import { parsePriestDetails } from './directGrantRules';
test('priest directory and identity edits with standalone MongoDB', {skip:!process.env.TEST_MONGODB_URI}, async t => {
    const client = await new MongoClient(process.env.TEST_MONGODB_URI!).connect();
    const db = client.db('priest_admin_test_'+randomUUID().replaceAll('-',''));
    const id = String(new ObjectId()), normal = String(new ObjectId());
    const original = {userId:id,title:'Иерей Николай',diocese:'Москва',confirmationMethod:'email',confirmedBy:'original',
        inviteCode:'UNCHANGED',queuePolicies:[{kind:'proskomidia',enabled:true,namesLimit:30}],slug:'priest',donationDetails:'old'};
    try {
        await db.collection('users').insertMany([{_id:new ObjectId(id),name:'Николай',email:'fixture@example.test',auth:{secret:'not exposed'}}, {_id:new ObjectId(normal),name:'Мирянин'}]);
        await db.collection('commemorators').insertMany([original,{userId:'legacy',title:'Иеромонах Пётр',diocese:'Тверь'}]);
        await db.collection('priestServices').insertOne({userId:id,entries:[{noteId:'real'}],enabled:true});
        await t.test('lists approved priests including legacy; search and pagination; no secrets',async()=>{
            const all = await listPriests(db);assert.equal(all.total,2);assert.equal(all.priests.length,2);
            assert.ok(!JSON.stringify(all).includes('not exposed'));assert.ok(!JSON.stringify(all).includes('UNCHANGED'));
            const searched=await listPriests(db,'fixture@example.test');assert.equal(searched.total,1);assert.equal(searched.priests[0].userId,id);
            assert.equal((await listPriests(db,'',1,1)).priests.length,1);
            assert.equal((await listPriests(db,'[')).total,0);
        });
        await t.test('rank edit retains official confirmation, queue, access and service contents',async()=>{
            await updatePriestIdentity(db,'admin',{userId:id,rank:'protoierey',name:'Николай Иванов',diocese:'Москва',reason:'Исправление сана',roles:['admin'],queuePolicies:[],inviteCode:'ATTACK'});
            const p=await db.collection('commemorators').findOne({userId:id});assert.equal(p?.title,'Протоиерей Николай Иванов');
            for(const k of ['confirmationMethod','confirmedBy','inviteCode','queuePolicies','slug'] as const) assert.deepEqual(p?.[k],original[k]);
            assert.equal(p?.roles,undefined);assert.deepEqual((await db.collection('priestServices').findOne({userId:id}))?.entries,[{noteId:'real'}]);
            const audit=await db.collection('commemoratorIdentityEdits').findOne({userId:id});assert.equal(audit?.by,'admin');assert.equal(audit?.before.title,original.title);assert.equal(audit?.after.rank,'protoierey');
        });
        await t.test('edit cannot approve a new priest or accept prototype rank keys',async()=>{
            await assert.rejects(updatePriestIdentity(db,'admin',{userId:normal,rank:'ierey',name:'N',diocese:'D',reason:'R'}),/Иерей не найден/);
            assert.equal(await db.collection('commemorators').countDocuments({userId:normal}),0);
            assert.throws(()=>parsePriestDetails({rank:'constructor',name:'N',diocese:'D'}),/сан/);
            await assert.rejects(updatePriestIdentity(db,'admin',{userId:id,rank:'ierey',name:'N',diocese:'D',reason:''}),/основание/);
        });
    } finally {await db.dropDatabase();await client.close();}
});
