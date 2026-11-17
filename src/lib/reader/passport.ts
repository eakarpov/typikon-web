import type { Db } from 'mongodb';
import { canonical, fail, revision, type Obj } from './core';

export function passportDescriptor(data:Obj,fields:Obj[]=[]){
    const refs=(items:Obj[])=>items.map(({id,revision=1})=>({id,revision})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    return {profile:'passport-r1',sourceId:data.sourceId,
        assertions:refs(data.assertions.filter((a:Obj)=>a.lifecycle==='active')),
        observations:refs(data.observations),cases:refs(data.cases),decisions:refs(data.reviewEvents),
        questions:refs(data.questions),fields:refs(fields)};
}
/** A record/revision pair is immutable. Changed evidence must declare a new revision. */
async function freeze(db:Db,kind:string,row:Obj){
    const id=kind+':'+row.id+':'+(row.revision??1),collection=db.collection<any>('readerMetadataVersions');
    await collection.updateOne({_id:id},{$setOnInsert:{kind,id:row.id,revision:row.revision??1,value:row}},{upsert:true});
    const saved=await collection.findOne({_id:id});
    if(canonical(saved.value)!==canonical(row))fail('map_revision_mismatch',409,'Метаданные изменены без новой ревизии.',{kind,id:row.id,revision:row.revision??1});
}
export async function freezePassport(db:Db,data:Obj){
    for(const [kind,rows]of Object.entries({assertion:data.assertions,observation:data.observations,case:data.cases,question:data.questions,decision:data.reviewEvents}))for(const row of rows as Obj[])await freeze(db,kind,row);
    const fields=[];
    for(const [key,value]of Object.entries(data.fields)){
        const id='field:'+data.sourceId+':'+key;
        const previous=await db.collection<any>('readerMetadataVersions').findOne({kind:'field',id},{sort:{revision:-1}});
        const fieldRevision=previous?previous.revision+(canonical(previous.value.value)===canonical(value)?0:1):1;
        const record={id,revision:fieldRevision,value};await freeze(db,'field',record);fields.push(record);
    }
    const descriptor=passportDescriptor(data,fields);
    return {...data,passportDescriptor:descriptor,passportRevision:revision('pr1',descriptor)};
}
