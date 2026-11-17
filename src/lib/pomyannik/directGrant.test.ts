import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { grantPriestDirectly, activatePriestEmailGrant, revokePendingPriestGrant } from './directGrant';
import { parsePriestDetails } from './directGrantRules';
import { capsOf } from '../rights';
const details={rank:'ierey',name:'Николай Петров',diocese:'Тестовая епархия',dioceseUrl:'',place:'Тестовый храм',about:'',donationDetails:'',reason:'Администратор лично знаком'};
test('direct appointment is restricted to administrators, not ordinary claim moderators',()=>{
    assert.equal(capsOf({roles:['admin']}).has('commemoration.grant'),true);
    assert.equal(capsOf({roles:['commemoration-moderator']}).has('commemoration.grant'),false);
    assert.equal(capsOf({roles:[]}).has('commemoration.grant'),false);
});
test('rank, name and diocese are validated; public data is explicitly selected',()=>{
    assert.equal(parsePriestDetails({...details,roles:['admin'],userId:'forged'}).title,'Иерей Николай Петров');
    for(const patch of [{rank:'diakon'},{diocese:''},{name:''},{dioceseUrl:'javascript:alert(1)'},{dioceseUrl:'https://user:pass@example.com'}])assert.throws(()=>parsePriestDetails({...details,...patch}));
});
test('direct priest appointments with real MongoDB',{skip:!process.env.TEST_MONGODB_URI},async t=>{
 const client=await new MongoClient(process.env.TEST_MONGODB_URI!).connect();const db=client.db('priest_direct_test_'+randomUUID().replaceAll('-',''));
 const a=String(new ObjectId()),b=String(new ObjectId());
 await db.collection('users').insertMany([{_id:new ObjectId(a),name:'Николай'},{_id:new ObjectId(b),name:'Другой'}]);
 try{
  await t.test('existing account gets access without a claim or a letter',async()=>{
    const {priest}=await grantPriestDirectly(db,'admin',{...details,targetType:'user',userId:a});
    assert.equal(priest?.userId,a);assert.equal(priest?.diocese,details.diocese);assert.equal(priest?.confirmationMethod,'administrator');
    assert.equal(priest?.public,false);assert.deepEqual(priest?.accepts,[]);
    assert.equal(await db.collection('commemoratorClaims').countDocuments({}),0);
    const journal=await db.collection<any>('commemoratorDirectGrants').findOne({_id:'user:'+a});assert.equal(journal?.history[0].by,'admin');
  });
  await t.test('editing identity preserves invite, acceptance, settings, and queue',async()=>{
    await db.collection('commemorators').updateOne({userId:a},{$set:{inviteCode:'keep-this-code',slug:'keep-this-slug',accepts:['proskomidia'],public:true,queueConfigured:true}});
    await db.collection('priestServices').insertOne({userId:a,entries:[{noteId:'keep-note'}]});
    const {priest}=await grantPriestDirectly(db,'admin2',{...details,rank:'protoierey',targetType:'user',userId:a});
    assert.equal(priest?.title,'Протоиерей Николай Петров');assert.equal(priest?.inviteCode,'keep-this-code');assert.equal(priest?.slug,'keep-this-slug');assert.equal(priest?.queueConfigured,true);assert.deepEqual(priest?.accepts,['proskomidia']);
    assert.equal((await db.collection('priestServices').findOne({userId:a}))?.entries[0].noteId,'keep-note');
  });
  await t.test('unknown account and missing reason do not grant access',async()=>{
    await assert.rejects(grantPriestDirectly(db,'admin',{...details,targetType:'user',userId:String(new ObjectId())}));
    await assert.rejects(grantPriestDirectly(db,'admin',{...details,targetType:'user',userId:b,reason:''}));
    assert.equal(await db.collection('commemorators').countDocuments({userId:b}),0);
  });
  await t.test('pre-registration email requires verified Google identity and binds once',async()=>{
    const email='known@example.com';const result=await grantPriestDirectly(db,'admin',{...details,targetType:'email',email:' Known@Example.com '});assert.equal(result.grant.status,'waiting-login');
    assert.equal(await activatePriestEmailGrant(db,b,email,false),null);
    assert.equal(await activatePriestEmailGrant(db,b,email,'true'),null);
    assert.equal(await activatePriestEmailGrant(db,b,'other@example.com',true),null);
    assert.equal((await activatePriestEmailGrant(db,b,email,true))?.userId,b);
    assert.equal(await activatePriestEmailGrant(db,a,email,true),null);
    assert.equal(await db.collection('commemoratorClaims').countDocuments({}),0);
  });
  await t.test('later logins do not reset the priest’s own details',async()=>{
    await db.collection('commemorators').updateOne({userId:b},{$set:{donationDetails:'Иерей изменил реквизиты',place:'Новое место'}});
    await activatePriestEmailGrant(db,b,'known@example.com',true);
    const priest=await db.collection('commemorators').findOne({userId:b});assert.equal(priest?.donationDetails,'Иерей изменил реквизиты');assert.equal(priest?.place,'Новое место');
  });
  await t.test('cancelled pending appointment cannot activate',async()=>{
    await grantPriestDirectly(db,'admin',{...details,targetType:'email',email:'cancel@example.com'});
    await revokePendingPriestGrant(db,'admin','cancel@example.com');
    assert.equal(await activatePriestEmailGrant(db,b,'cancel@example.com',true),null);
    await assert.rejects(revokePendingPriestGrant(db,'admin','known@example.com'));
  });
 }finally{await db.dropDatabase();await client.close();}
});
