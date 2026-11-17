import type { Db } from 'mongodb';
import pilot from '@/data/reader/pilot.json';
import { ReaderService } from '@/lib/reader/service';
import { fail, sha, type Obj } from '@/lib/reader/core';
import type { Material, Target } from './core';
import type { StudyReaderAttachment, StudySourceAddress } from './reader-contract';

export const pilotChapter = pilot.materials.find(m=>m.id==='P03')!;
export function sourceAddressUrl(base:string,address:StudySourceAddress){
  const url=new URL(base);
  url.searchParams.set('revision',address.sourceRevision);
  url.searchParams.set('passport',address.passportRevision);
  if(address.selector)url.searchParams.set('fragment',address.selector.fragmentId);
  return url.toString();
}
/** Join the old material to an activated registry entry, checking the same native raw body. */
export async function attachStudyReader(material:Material,target:Target,raw:string,db:Db):Promise<Material>{
  if(material.target.kind!=='text'||material.target.id!==pilotChapter.nativeRef.id)
    fail('unsupported_source',422,'Для этого опыта выбрана глава Маргарита.');
  const service=new ReaderService(db);
  const resolved=await service.resolve({contract:'cs-reader/1',legacyTarget:{...target,...material.target}}) as Obj;
  const state=await service.entry(resolved.resolvedAddress);
  if(state.descriptor.units.length!==1)fail('unsupported_source',422,'Для этого опыта требуется одна глава.');
  const unit=state.descriptor.units[0];
  const body=await service.body(state.entry,unit);
  if(raw!==body.raw||'br1_'+sha(raw)!==unit.bodyRevision)
    fail('revision_unavailable',410,'Текст study/material не соответствует опубликованной ревизии.');
  const fragment=await db.collection<any>('readerFragments').findOne({sourceId:state.entry.sourceId,occurrenceId:unit.occurrenceId});
  if(!fragment)fail('corpus_unavailable',503,'У главы нет зарегистрированного фрагмента.');
  const address=state.resolvedAddress as StudySourceAddress;
  const fragmentAddress:StudySourceAddress={...address,selector:{kind:'fragment',fragmentId:fragment._id}};
  await service.selected(state.descriptor,fragmentAddress);
  const attachment:StudyReaderAttachment={
    contract:'cs-reader/1',sourceId:state.entry.sourceId,address,snapshot:state.snapshot as StudyReaderAttachment['snapshot'],
    bodyRef:{bodyId:unit.bodyId,bodyRevision:unit.bodyRevision},
    permanentUrl:state.entry.source.canonicalUrl,versionUrl:sourceAddressUrl(state.entry.source.canonicalUrl,address),
    fragment:{address:fragmentAddress,url:sourceAddressUrl(state.entry.source.canonicalUrl,fragmentAddress),label:'Глава целиком'},
    passportUrl:'/api/v2/study/reader/v1/passport/'+state.entry.sourceId+'?revision='+state.snapshot.passportRevision,
    editorialStatus:state.entry.source.editorialStatus,passport:state.passport as StudyReaderAttachment['passport'],
  };
  return {...material,reader:attachment};
}
