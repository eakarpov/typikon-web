import '@/scripts/lib/env';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import Ajv from 'ajv';
import { openapi } from '@/lib/api/v2/openapi';
import { ReaderService } from '@/lib/reader/service';
import { readerDb } from '@/lib/reader/registry';
import { checkPassport, checkRead } from '@/lib/reader/acceptance';
import { sha, type Obj } from '@/lib/reader/core';
import { pilotChapter } from '@/lib/study/reader';

async function main(){
  const at=process.argv.indexOf('--base'),base=new URL(at>=0?process.argv[at+1]:'http://127.0.0.1:3127');
  assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname),'HTTP acceptance only targets the local test contour');
  const db=await readerDb(),service=new ReaderService(db);const before=await service.release();
  const report:Obj={date:'2026-11-14',base:base.origin,checks:[],requests:[]};
  const request=async(path:string,body?:Obj)=>{
    const response=await fetch(new URL(path,base),{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
    report.requests.push({path:path.split('?')[0],method:body?'POST':'GET',status:response.status});return response;
  };
  const target={kind:'text',id:pilotChapter.nativeRef.id},query=encodeURIComponent(JSON.stringify(target));
  const plain=await request('/api/v2/study/material?target='+query);assert.equal(plain.status,200);const old=await plain.json();assert.equal('reader'in old,false);
  const get=await request('/api/v2/study/material?reader=pilot&target='+query);assert.equal(get.status,200);const material=await get.json();
  assert.ok(get.headers.get('deprecation'));assert.match(get.headers.get('cache-control')??'',/no-store/);assert.equal(get.headers.has('x-license'),false);assert.ok(!get.headers.get('link')?.includes('rel="license"'));
  const post=await request('/api/v2/study/material',{target,reader:'pilot'});assert.equal(post.status,200);assert.deepEqual(await post.json(),material);
  const {reader,...unchanged}=material;assert.deepEqual(unchanged,old);
  const spec:Obj=openapi();const ajv=new Ajv({allErrors:true,unknownFormats:'ignore',logger:false});ajv.addSchema({$id:'study-contract',components:spec.components},'study-contract');const check=ajv.compile({$ref:'study-contract#/components/schemas/StudyMaterialWithReader'});assert.ok(check(material),JSON.stringify(check.errors));
  checkPassport(reader.passport);assert.equal(reader.address.sourceRevision,reader.snapshot.sourceRevision);assert.equal(reader.passport.passportRevision,reader.snapshot.passportRevision);
  const passport=await request(reader.passportUrl);assert.equal(passport.status,200);assert.deepEqual((await passport.json()).data,reader.passport);
  const fragmentUrl=new URL(reader.fragment.url);const fragment=await request(fragmentUrl.pathname+fragmentUrl.search);assert.equal(fragment.status,200);assert.match(fragment.headers.get('x-robots-tag')??'',/noindex/);assert.ok((await fragment.text()).includes(material.title));
  const address=await request('/api/v2/study/reader/v1/resolve',{contract:'cs-reader/1',url:reader.fragment.url});assert.equal(address.status,200);const resolved=(await address.json()).data;assert.equal(resolved.resolvedAddress.selector.fragmentId,reader.fragment.address.selector.fragmentId);
  const read=await request('/api/v2/study/reader/v1/read',{contract:'cs-reader/1',address:reader.fragment.address,profileSetId:'cs-pilot-source-r1'});assert.equal(read.status,200);const data=(await read.json()).data;checkRead(data);assert.equal(data.units[0].bodyRef.bodyRevision,reader.bodyRef.bodyRevision);
  const raw=await db.collection('texts').findOne({_id:new(await import('mongodb')).ObjectId(target.id)});assert.equal(sha(raw!.content),'9b908856543a0c9930d633d2c5f57337151fd38d19c29fca9b7a65224612896f');assert.equal(data.projections[0].rawText,raw!.content);
  const page=await request('/opyty/cs-reader/margarit');assert.equal(page.status,200);assert.match(await page.text(),/noindex/);
  const index=await request('/opyty/cs-reader');assert.equal(index.status,200);assert.ok((await index.text()).includes('/opyty/cs-reader/margarit'));
  const home=await request('/');assert.equal(home.status,200);assert.equal((await home.text()).includes('/opyty/cs-reader/margarit'),false);
  const sitemap=await request('/sitemap.xml');assert.equal(sitemap.status,200);assert.equal((await sitemap.text()).includes('/opyty/cs-reader/margarit'),false);
  const invalid=await request('/api/v2/study/material?reader=unknown&target='+query);assert.equal(invalid.status,400);
  assert.equal((await service.release()).release._id,before.release._id);
  report.sourceId=reader.sourceId;report.sourceRevision=reader.address.sourceRevision;report.passportRevision=reader.address.passportRevision;report.fragmentId=reader.fragment.address.selector.fragmentId;
  report.rawSha256=sha(raw!.content);report.permanentUrl=reader.permanentUrl;report.localDemoUrl=new URL('/opyty/cs-reader/margarit',base).toString();report.releaseId=before.release._id;
  report.checks=['legacy default payload unchanged','GET and POST opt-in identical','StudyMaterialWithReader schema','same text revision and passport snapshot','passport API','fragment URL and resolver','reader text equals original Mongo content','no blanket license','deprecated retained','experimental page noindex','entry only in experiments','no homepage or sitemap exposure','unknown mode rejected','release pointer unchanged'];
  const output=JSON.stringify(report,null,2);console.log(output);const out=process.argv.indexOf('--report');if(out>=0)writeFileSync(process.argv[out+1],output+'\n');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{const {default:client}=await import('@/lib/mongodb');await(await client).close();});
