import '@/scripts/lib/env';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { readerDb } from '@/lib/reader/registry';
import { ReaderService } from '@/lib/reader/service';
import { checkRead, checkPassport } from '@/lib/reader/acceptance';
import { envelope, LIMITS, PILOT, sha, type Obj } from '@/lib/reader/core';
import { profileSets, project } from '@/lib/reader/projection';
import { legacyNativeId, publicChant } from '@/lib/reader/legacy';
import { getChant } from '@/lib/chants';
import { chantDetail } from '@/lib/api/v2/serialize';

/** Read-only acceptance of the active real pilot. Mutations belong to isolated integration tests. */
async function main(){
    const db=await readerDb(),service=new ReaderService(db);
    const initial=await service.release();
    const report:Obj={date:'2026-11-14',scope:'read-only real local pilot',releaseId:initial.release._id,materials:[],checks:[],sourceBodiesStored:0};
    const catalog=await service.catalog({pilotId:PILOT});assert.equal(catalog.items.length,5);
    for(const source of catalog.items){
        const passport=await service.passport(source.sourceId);checkPassport(passport);
        const result:Obj={sourceId:source.sourceId,title:source.title,passportRevision:passport.passportRevision,fields:passport.fields,
            assertionStates:passport.assertions.map((a:Obj)=>({id:a.id,reviewStatus:a.reviewStatus,predicate:a.predicate,valueType:a.value.type})),
            openQuestions:passport.questions.filter((q:Obj)=>q.status==='open').map((q:Obj)=>q.id),profiles:[]};
        for(const ps of profileSets){
            let cursor:string|undefined,address:Obj={version:2,sourceId:source.sourceId},units=0,pages=0,maxBytes=0;
            const occurrences=new Set<string>();
            do{
                const data=await service.read({contract:'cs-reader/1',address,profileSetId:ps.id,limit:20,...(cursor?{cursor}:{})});
                checkRead(data);const bytes=Buffer.byteLength(JSON.stringify(envelope(data)));assert.ok(bytes<=LIMITS.maxResponseBytes);maxBytes=Math.max(bytes,maxBytes);
                for(const unit of data.units){assert.ok(!occurrences.has(unit.occurrenceId));occurrences.add(unit.occurrenceId);}
                units+=data.units.length;pages++;address=data.resolvedAddress;cursor=data.page.nextCursor??undefined;
                if(source.kind==='text'){
                    const p=data.projections[0];assert.equal(sha(p.rawText),'9b908856543a0c9930d633d2c5f57337151fd38d19c29fca9b7a65224612896f');
                    result.raw={utf16:p.rawText.length,codePoints:[...p.rawText].length,pua:[...p.rawText].filter((c:string)=>/\p{Co}/u.test(c)).length,sha256:sha(p.rawText)};
                    const token=p.tokens.find((t:Obj)=>t.type==='word'&&t.rawRanges[0][1]-t.rawRanges[0][0]>1);
                    await assert.rejects(service.read({contract:'cs-reader/1',address,profileSetId:ps.id,window:{bodyId:p.bodyId,rawRange:[token.rawRanges[0][0]+1,token.rawRanges[0][1]]}}),(e:any)=>e.code==='invalid_boundary');
                    const supplementary=[...p.rawText].find((ch:string)=>ch.codePointAt(0)!>0xffff)!;const offset=p.rawText.indexOf(supplementary);
                    await assert.rejects(service.read({contract:'cs-reader/1',address,profileSetId:ps.id,window:{bodyId:p.bodyId,rawRange:[offset+1,offset+2]}}),(e:any)=>e.code==='invalid_boundary');
                }
            }while(cursor);
            result.profiles.push({profileSetId:ps.id,units,pages,maxBytes});
        }
        if(source.legacyTarget?.kind==='chant'){
            const row=getChant(await legacyNativeId(Number(source.legacyTarget.id),db));assert.ok(row);
            const old=chantDetail(await publicChant(row));assert.equal(old.id,Number(source.legacyTarget.id));assert.equal('contract'in old,false);
        }
        report.materials.push(result);
    }
    for(const {name}of await db.listCollections({name:/^reader/}).toArray()){
        const bodies=await db.collection(name).countDocuments({$or:[{raw:{$exists:true}},{rawText:{$exists:true}},{viewText:{$exists:true}},{content:{$exists:true}}]});report.sourceBodiesStored+=bodies;
    }
    const previousAt=process.argv.indexOf('--previous-report');
    if(previousAt>=0){
        const previous=JSON.parse(readFileSync(process.argv[previousAt+1],'utf8'));
        for(const source of previous.sources){
            const current=initial.release.entries.find((e:Obj)=>e.sourceId===source.sourceId);assert.ok(current);assert.equal(current.sourceRevision,source.sourceRevision);
            checkPassport(await service.passport(source.sourceId,source.passportRevision));
            const old=await service.read({contract:'cs-reader/1',address:{version:2,sourceId:source.sourceId,sourceRevision:source.sourceRevision,passportRevision:source.passportRevision},profileSetId:profileSets[0].id,limit:20});checkRead(old);
        }
        report.historicalPassportsChecked=previous.sources.length;
    }
    assert.equal(report.sourceBodiesStored,0);assert.equal((await service.release()).release._id,initial.release._id);
    report.checks=['five passports: schema and evidence references','all three profiles: snapshot/map/token digests and UTF16 ranges','pagination without dropped or repeated occurrences','response byte budgets','exact chapter SHA and supplementary PUA','reject word/surrogate cuts','legacy chant serialization unchanged','no text bodies in registry','active release unchanged during read-only checks'];
    const output=JSON.stringify(report,null,2);const at=process.argv.indexOf('--report');if(at>=0)writeFileSync(process.argv[at+1],output+'\n');console.log(output);
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{const {default:client}=await import('@/lib/mongodb');await(await client).close();});
