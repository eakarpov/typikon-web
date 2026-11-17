import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { MongoClient, ObjectId } from 'mongodb';
import pilot from '@/data/reader/pilot.json';
import { publishPilot } from './registry';
import { ReaderService } from './service';
import { checkRead, checkPassport, checkHistoricalDate } from './acceptance';
import { canonical, envelope, PILOT, revision, sha, validate, type Obj } from './core';
import { legacyNativeId, legacyPublicIds, prepareLegacy } from './legacy';
import { rules, resolvedRow, nativeRow, loadBody } from './native';
import { freezePassport } from './passport';
import { profileSets } from './projection';

const syntheticRaw = 'Сло́во бг҃ и сло\uEFFFво '+String.fromCodePoint(0xf0023)+'\nВторая строка.\n';
const authorKey = 'assert:chapter-author-candidate';
const profileSetId = profileSets[0].id;
const contract = 'cs-reader/1';
const expectedError = (code:string,status:number) => (error:any) => error.code===code && error.status===status;
function build(path:string, version:number) {
    const db=new Database(path);
    db.exec(`CREATE TABLE groups(group_id TEXT PRIMARY KEY,slot_key TEXT,source_book TEXT,memory_id TEXT);
        CREATE TABLE canons(canon_id TEXT PRIMARY KEY,slot_key TEXT,memory_id TEXT,edition_id TEXT,title TEXT,language TEXT);
        CREATE TABLE editions(edition_id TEXT PRIMARY KEY,source_book TEXT);
        CREATE TABLE akathists(akathist_id TEXT PRIMARY KEY,source_book TEXT,title TEXT,language TEXT);
        CREATE TABLE fixed_texts(text_id TEXT PRIMARY KEY,text TEXT);
        CREATE TABLE content_items(item_id INTEGER PRIMARY KEY,group_id TEXT,canon_id TEXT,akathist_id TEXT,prayer_id TEXT,
            text TEXT,ref_text_id TEXT,ref_item_id INTEGER,language TEXT,ode INTEGER,item_index INTEGER,content_unit TEXT,
            stanza_kind TEXT,stanza INTEGER,marker TEXT,repeat_count INTEGER,inline_rubric TEXT,title TEXT);`);
    const canon=pilot.materials[0].nativeRef.id, akathist=pilot.materials[1].nativeRef.id;
    db.prepare('INSERT INTO canons VALUES (?,?,?,?,?,?)').run(canon,'stable-canon-slot',null,null,'Тестовый канон','cu');
    db.prepare('INSERT INTO akathists VALUES (?,?,?,?)').run(akathist,'fixture-edition','Тестовый акафист','cu');
    db.prepare('INSERT INTO fixed_texts VALUES (?,?)').run('stable-irmos',version>=3?'Ирмос исправленный.':'Ирмос исходный.');
    for(const key of ['troparion','intruder','duplicate','removed','unresolved','same-context'])db.prepare('INSERT INTO groups VALUES (?,?,?,?)').run(key,key,'fixture-edition',null);
    const add=(id:number,group:string|null,text:string|null,extra:Obj={})=>{
        const row={item_id:id,group_id:group,text,language:'cu',item_index:1,content_unit:'troparion',...extra};
        db.prepare(`INSERT INTO content_items(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(()=>'?').join(',')})`).run(...Object.values(row));
    };
    add(version===1?132:501,null,null,{canon_id:canon,ref_text_id:'stable-irmos',ode:1,content_unit:'irmos'});
    if(version!==4)add(version===1?133:502,null,'Первый тропарь.',{canon_id:canon,ode:1,item_index:2});
    add(version===1?134:503,null,'Второй тропарь.',{canon_id:canon,ode:3,item_index:1});
    add(version===1?50:701,null,'Кондак.',{akathist_id:akathist,content_unit:'kontakion',stanza_kind:'kontakion',stanza:1});
    add(version===1?77050:601,'troparion',version>=3?'Тропарь исправленный.':'Тропарь исходный.');
    if(version===1){add(910,'duplicate','Повтор.');add(920,'removed','Удаляется.');add(930,'unresolved',null,{ref_text_id:'absent'});add(940,'same-context','Вариант А.');add(941,'same-context','Вариант Б.');}
    else {add(132,'intruder','Посторонний текст.');add(77050,'intruder','Другой посторонний.',{item_index:2});add(801,'duplicate','Повтор.');add(802,'duplicate','Повтор.');add(810,'same-context','Вариант В.');add(811,'same-context','Вариант А.');add(812,'unresolved',null,{ref_text_id:'absent'});}
    db.close();
}

test('Э1-09: isolated Mongo + rebuilt SQLite acceptance', {skip:process.env.READER_INTEGRATION!=='1',timeout:120000}, async t=>{
    await import('@/scripts/lib/env');
    const uri=process.env.MONGODB_URI!;
    assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(uri).hostname),'Integration tests only use local MongoDB');
    const name='reader_e109_'+randomUUID().replace(/-/g,'');
    const client=await new MongoClient(uri).connect(), db=client.db(name);
    const dir=mkdtempSync(join(tmpdir(),'reader-e109-'));const previousRules=process.env.RULES_DB;
    const report:Obj={date:'2026-11-14',scope:'isolated synthetic fixtures, real MongoDB and four real SQLite files',database:name,scenarios:[]};
    const scenario=async(name:string,fn:()=>Promise<void>)=>t.test(name,async()=>{try{await fn();report.scenarios.push({name,status:'passed'});}catch(error){report.scenarios.push({name,status:'failed',error:(error as Error).message});throw error;}});
    const files=[1,2,3,4].map(n=>join(dir,'rules-'+n+'.db'));files.forEach((file,i)=>build(file,i+1));
    const textId=new ObjectId(pilot.materials[2].nativeRef.id),bookId=new ObjectId('6992d190b9df99cbe01f6174');
    const fixture={...pilot,expectedLibrarySha256:sha(syntheticRaw)};
    const service=new ReaderService(db);let first:any,second:any,third:any;let oldRead:Obj,oldFragment:string;
    const read=async(sourceId:string,extra:Obj={})=>service.read({contract,address:{version:2,sourceId},profileSetId,...extra});
    try {
        process.env.RULES_DB=files[0];
        await db.collection('books').insertOne({_id:bookId,name:'Тестовый сборник',public:true});
        await db.collection('texts').insertOne({_id:textId,bookId,name:'Тестовая глава',content:syntheticRaw,language:'cu',readiness:'texted',public:true,alias:'fixture-chapter'});
        await scenario('initial publication and all pilot read/passport contracts',async()=>{
            first=await publishPilot(db,{apply:true,activate:true,pilotConfig:fixture});
            for(const source of first.sources){const p=await read(source.sourceId);checkRead(p);checkPassport(await service.passport(source.sourceId));}
            oldRead=await read(first.sources[0].sourceId,{limit:1});
            oldFragment=(await db.collection<any>('readerFragments').findOne({sourceId:first.sources[0].sourceId,occurrenceId:oldRead.units[0].occurrenceId}))!._id;
        });
        await scenario('unknown translator and original canon remain questions, not negative facts',async()=>{
            const chapter=await service.passport(first.sources[2].sourceId),irmos=await service.passport(first.sources[3].sourceId);
            assert.equal(chapter.fields.translator.state,'unknown');assert.equal(irmos.fields.originalPartOf.state,'unknown');
            assert.equal(irmos.assertions.some((a:Obj)=>a.predicate==='originalPartOf'),false);
            assert.equal(chapter.assertions.find((a:Obj)=>a.id===authorKey).reviewStatus,'unreviewed');
            const bad=structuredClone(chapter);bad.fields.authorship.state='recorded';validate('PassportResponse',envelope(bad));assert.throws(()=>checkPassport(bad),expectedError('contract_inconsistent',409));
        });
        await scenario('E1-10 study/material adds the same passport and address only on explicit pilot requests',async()=>{
            const {material}=await import('@/lib/study/material');
            const target={kind:'text' as const,id:String(textId)};
            const plain=await material(target,{db});
            assert.equal(plain.reader,undefined);
            const joined=await material(target,{db,reader:'pilot'});
            const {reader,...old}=joined;assert.deepEqual(old,plain);assert.ok(reader);
            assert.equal(reader.sourceId,first.sources[2].sourceId);assert.equal(reader.passport.fields.translator.state,'unknown');
            const resolved:any=await service.resolve({contract,url:reader.fragment.url});assert.equal(resolved.source.sourceId,reader.sourceId);
            assert.equal(resolved.resolvedAddress.selector.fragmentId,reader.fragment.address.selector!.fragmentId);
            assert.deepEqual(await service.passport(reader.sourceId,reader.address.passportRevision),reader.passport);
            await db.collection('texts').updateOne({_id:textId},{$set:{content:syntheticRaw+' Непубликованная правка.'}});
            await assert.rejects(material(target,{db,reader:'pilot'}),expectedError('revision_unavailable',410));
            assert.notEqual((await material(target,{db})).sourceHash,plain.sourceHash);
            await db.collection('texts').updateOne({_id:textId},{$set:{content:syntheticRaw,public:false}});
            await assert.rejects(material(target,{db,reader:'pilot'}),expectedError('not_found',404));
            await db.collection('texts').updateOne({_id:textId},{$set:{public:true}});
            await assert.rejects(material({kind:'bible',id:'Gen',edition:'fixture',chapter:1},{db,reader:'pilot'}),expectedError('unsupported_source',422));
        });
        await scenario('fragment bindings and token references cannot borrow another source/body',async()=>{
            const sourceId=first.sources[0].sourceId,revision=first.sources[0].sourceRevision;
            const key=oldFragment+':'+revision;const collection=db.collection<any>('readerFragmentBindings');const previous=await collection.findOne({_id:key});
            await collection.updateOne({_id:key},{$set:{bodyId:'bdy_00000000000040008000000000000999'}});
            await assert.rejects(read(sourceId,{address:{version:2,sourceId,selector:{kind:'fragment',fragmentId:oldFragment}}}),expectedError('fragment_changed',409));
            await collection.updateOne({_id:key},{$set:{bodyId:previous.bodyId}});
            const foreign=await read(first.sources[4].sourceId);const token=foreign.projections[0].tokens.find((t:Obj)=>t.lookupKey);
            await assert.rejects(service.lookup({contract,address:oldRead.resolvedAddress,profileSetId,tokens:[{bodyId:token.bodyId,bodyRevision:token.bodyRevision,tokenId:token.tokenId,tokenizerProfileId:token.tokenizerProfileId,rawRanges:token.rawRanges}]}),expectedError('map_revision_mismatch',409));
        });
        await scenario('renamed source and library aliases retain former URLs; editions are not mixed',async()=>{
            const sourceId=first.sources[2].sourceId;
            const source=await db.collection<any>('readerSources').findOne({_id:sourceId});
            const oldAlias=source.aliases[0];
            await db.collection('readerSources').updateOne({_id:sourceId as any},{$set:{slug:'fixture-new-slug'},$addToSet:{aliases:'fixture-new-slug'}});
            await db.collection('texts').updateOne({_id:textId},{$set:{alias:'fixture-chapter-new',aliases:['fixture-chapter','fixture-chapter-new']}});
            for(const path of ['/sources/'+oldAlias,'/sources/fixture-new-slug','/reading/fixture-chapter','/reading/fixture-chapter-new']){
                const resolved:any=await service.resolve({contract,url:'https://www.typikon.info'+path});assert.equal(resolved.source.sourceId,sourceId);
            }
            await assert.rejects(service.resolve({contract,legacyTarget:{kind:'text',id:String(textId),edition:'different-edition'}}),expectedError('unsupported_source',422));
        });
        await scenario('library edit preserves identity; pinned body/token cannot select latest',async()=>{
            const before=await read(first.sources[2].sourceId);const previous=before.projections[0].tokens.find((x:Obj)=>x.lookupKey);
            await db.collection('texts').updateOne({_id:textId},{$set:{content:syntheticRaw+'Правка.'}});
            await assert.rejects(service.read({contract,address:before.resolvedAddress,profileSetId}),expectedError('revision_unavailable',410));
            await assert.rejects(service.lookup({contract,address:before.resolvedAddress,profileSetId,tokens:[{bodyId:previous.bodyId,bodyRevision:previous.bodyRevision,tokenId:previous.tokenId,tokenizerProfileId:previous.tokenizerProfileId,rawRanges:previous.rawRanges}]}),expectedError('revision_unavailable',410));
            await db.collection('texts').updateOne({_id:textId},{$set:{content:syntheticRaw}});
            assert.equal((await read(first.sources[2].sourceId)).source.sourceId,before.source.sourceId);
        });
        await scenario('hidden text/book unavailable even through pinned address and passport',async()=>{
            const id=first.sources[2].sourceId;await db.collection('books').updateOne({_id:bookId},{$set:{public:false}});
            await assert.rejects(service.passport(id),expectedError('not_found',404));await assert.rejects(read(id),expectedError('not_found',404));
            await db.collection('books').updateOne({_id:bookId},{$set:{public:true}});
        });
        await scenario('rebuild remaps old public IDs before publication and rejects reused native numbers',async()=>{
            process.env.RULES_DB=files[1];
            await assert.rejects(legacyNativeId(132,db),expectedError('ambiguous',409));
            second=await publishPilot(db,{apply:true,activate:true,pilotConfig:fixture});
            assert.equal(await legacyNativeId(132,db),501);assert.equal(await legacyNativeId(77050,db),601);
            assert.equal(resolvedRow(nativeRow(await legacyNativeId(132,db))!).raw,'Ирмос исходный.');
            const publicIds=await legacyPublicIds([132,77050,501],db);assert.equal(publicIds.get(501),132);assert.notEqual(publicIds.get(132),132);assert.notEqual(publicIds.get(77050),77050);
        });
        await scenario('pure renumbering preserves source/body/occurrence IDs, fragments and source revisions',async()=>{
            for(let i=0;i<5;i++){assert.equal(second.sources[i].sourceId,first.sources[i].sourceId);assert.equal(second.sources[i].sourceRevision,first.sources[i].sourceRevision);assert.equal(second.sources[i].passportRevision,first.sources[i].passportRevision);}
            const current=await read(second.sources[0].sourceId,{address:{version:2,sourceId:second.sources[0].sourceId,selector:{kind:'fragment',fragmentId:oldFragment}}});checkRead(current);
            await assert.rejects(read(second.sources[0].sourceId,{address:current.resolvedAddress,cursor:oldRead.page.nextCursor,limit:1}),expectedError('cursor_mismatch',409));
            assert.equal(current.units[0].occurrenceId,oldRead.units[0].occurrenceId);assert.equal(current.units[0].bodyRef.bodyId,oldRead.units[0].bodyRef.bodyId);
            const resolved:any=await service.resolve({contract,url:'https://www.typikon.info/chants/132'});assert.equal(resolved.source.sourceId,first.sources[3].sourceId);
        });
        await scenario('duplicates are ambiguous in both directions, deleted and unresolved IDs are reserved',async()=>{
            await assert.rejects(legacyNativeId(910,db),expectedError('ambiguous',409));await assert.rejects(legacyNativeId(920,db),expectedError('ambiguous',409));
            assert.equal(await legacyNativeId(930,db),812);assert.equal(await legacyNativeId(940,db),811);assert.equal(await legacyNativeId(941,db),810);
            const ids=await legacyPublicIds([801,802],db);assert.ok([...ids.values()].every(id=>id!==910&&id>77050));
        });
        await scenario('same rebuilt publication is idempotent',async()=>{const again=await publishPilot(db,{apply:true,activate:true,pilotConfig:fixture});assert.equal(again.releaseId,second.releaseId);});
        await scenario('formula edit updates dependent canon and irmos, preserving addresses; no silent fragment move',async()=>{
            process.env.RULES_DB=files[2];third=await publishPilot(db,{apply:true,activate:true,pilotConfig:fixture});
            for(const i of [0,3,4]){assert.equal(third.sources[i].sourceId,first.sources[i].sourceId);assert.notEqual(third.sources[i].sourceRevision,first.sources[i].sourceRevision);}
            const canon=await read(third.sources[0].sourceId),irmos=await read(third.sources[3].sourceId);checkRead(canon);checkRead(irmos);
            assert.equal(canon.units[0].bodyRef.bodyId,irmos.units[0].bodyRef.bodyId);assert.equal(irmos.units[0].bodyRef.bodyId,oldRead.units[0].bodyRef.bodyId);
            await assert.rejects(read(third.sources[0].sourceId,{address:{version:2,sourceId:third.sources[0].sourceId,selector:{kind:'fragment',fragmentId:oldFragment}}}),expectedError('fragment_changed',409));
            await assert.rejects(service.read({contract,address:oldRead.resolvedAddress,profileSetId,limit:1}),expectedError('revision_unavailable',410));
            const current=await read(third.sources[0].sourceId,{limit:1});await assert.rejects(read(third.sources[0].sourceId,{address:current.resolvedAddress,cursor:oldRead.page.nextCursor,limit:1}),expectedError('cursor_mismatch',409));
        });
        await scenario('removed occurrence and fragment return 410 instead of selecting a neighbour',async()=>{
            const sourceId=third.sources[0].sourceId,before=await read(sourceId);
            const removed=before.units[1].occurrenceId;
            const fragment=(await db.collection<any>('readerFragments').findOne({sourceId,occurrenceId:removed}))!._id;
            process.env.RULES_DB=files[3];third=await publishPilot(db,{apply:true,activate:true,pilotConfig:fixture});
            await assert.rejects(read(sourceId,{address:{version:2,sourceId,selector:{kind:'occurrence',occurrenceId:removed}}}),expectedError('occurrence_removed',410));
            await assert.rejects(read(sourceId,{address:{version:2,sourceId,selector:{kind:'fragment',fragmentId:fragment}}}),expectedError('fragment_removed',410));
        });
        await scenario('passport alternatives stay disputed; metadata-only revision keeps text revision',async()=>{
            const id=third.sources[2].sourceId,old=await service.passport(id);let p=structuredClone(old);const alt=structuredClone(p.assertions.find((a:Obj)=>a.id===authorKey));alt.id='fixture:alternative-author';alt.value.label='Тестовая альтернатива';alt.value.ref={namespace:'rules.persons',id:'fixture-other'};p.assertions.push(alt);
            const c=p.cases.find((c:Obj)=>c.id==='case:chapter-author');c.revision++;c.assertionIds.push(alt.id);c.relationship='mutually_exclusive';p.fields.authorship={state:'disputed',display:'Тестовый спор, решения нет.',assertionIds:[authorKey,alt.id],questionIds:['q:chapter-author']};
            p=await freezePassport(db,p);checkPassport(p);
            const stale=structuredClone(p);stale.questions[0].reason+=' Changed without a revision';await assert.rejects(freezePassport(db,stale),expectedError('map_revision_mismatch',409));
            await db.collection('readerPassports').insertOne({_id:p.passportRevision,sourceId:id,data:p});const {release}=await service.release();const next=structuredClone(release);next._id='fixture-metadata-release';next.entries.find((e:Obj)=>e.sourceId===id).passportRevision=p.passportRevision;await db.collection('readerReleases').insertOne(next);await db.collection('readerPilots').updateOne({_id:PILOT as any},{$set:{activeRelease:next._id},$addToSet:{history:next._id}});
            const current=await read(id);assert.equal(current.snapshot.sourceRevision,third.sources[2].sourceRevision);assert.equal(current.snapshot.passportRevision,p.passportRevision);assert.equal((await service.passport(id,old.passportRevision)).fields.authorship.state,'candidate');assert.equal((await service.passport(id)).fields.authorship.state,'disputed');assert.deepEqual(c.preferredAssertionIds,[]);
            await assert.rejects(publishPilot(db,{apply:true,activate:true,pilotConfig:fixture}),expectedError('map_revision_mismatch',409));assert.equal((await service.release()).release._id,next._id);
            const technical=structuredClone(p);technical.assertions.find((a:Obj)=>a.value.type==='timestamp').predicate='composedAt';validate('PassportResponse',envelope(technical));assert.throws(()=>checkPassport(technical),expectedError('contract_inconsistent',409));
            const broken=structuredClone(p);broken.assertions[0].evidenceLinks[0].observationId='missing';validate('PassportResponse',envelope(broken));assert.throws(()=>checkPassport(broken),expectedError('contract_inconsistent',409));
        });
        await scenario('semantic errors are rejected even when JSON matches OpenAPI',async()=>{
            const data=await read(third.sources[2].sourceId);checkRead(data);
            for(const mutate of [(d:Obj)=>d.projections[0].map.bodyRevision='br1_'+'0'.repeat(64),(d:Obj)=>d.projections[0].tokens[0].rawRanges=[[100000,100001]],(d:Obj)=>d.snapshot.passportRevision='pr1_'+'0'.repeat(64)]){const bad=structuredClone(data);mutate(bad);validate('ReadResponse',envelope(bad));assert.throws(()=>checkRead(bad),expectedError('contract_inconsistent',409));}
            const date={type:'historical_date',kind:'interval',calendar:'unknown',precision:'year',approximate:true,rawLabel:'тестовая датировка',from:{year:1000},to:{year:1100}};checkHistoricalDate(date);const bad={...date,from:{year:1200}};validate('HistoricalDateValue',bad);assert.throws(()=>checkHistoricalDate(bad),expectedError('contract_inconsistent',409));
        });
        await scenario('no source bodies duplicated in registry',async()=>{
            for(const {name} of await db.listCollections({name:/^reader/}).toArray())assert.equal(await db.collection(name).countDocuments({$or:[{raw:{$exists:true}},{rawText:{$exists:true}},{viewText:{$exists:true}},{content:{$exists:true}}]}),0,name);
        });
    } finally {
        process.env.RULES_DB=previousRules;
        if(process.env.READER_ACCEPTANCE_REPORT)writeFileSync(process.env.READER_ACCEPTANCE_REPORT,JSON.stringify(report,null,2)+'\n');
        assert.ok(name.startsWith('reader_e109_'));await db.dropDatabase();await client.close();const {default:sharedClient}=await import('@/lib/mongodb');await(await sharedClient).close();rmSync(dir,{recursive:true,force:true});
    }
});
