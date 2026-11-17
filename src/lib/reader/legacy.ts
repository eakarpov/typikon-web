import type { Db } from 'mongodb';
import { ReaderError, fail, revision, type Obj } from './core';
import { rules, scanRows, resolvedRow, signatureOf, contextOf } from './native';
import { fail as legacyFail } from '@/lib/api/v2/http';

export function legacyFailure(error: unknown) { if (!(error instanceof ReaderError)) return null; return legacyFail(error.status === 404 ? 'not_found' : error.status === 409 ? 'conflict' : 'corpus_unavailable', error.message); }
export async function nativeIdForRequest(id: number, dataset?: string) { if (dataset) { if (dataset !== rules().datasetRevision) fail('revision_unavailable', 410, 'Нужна прежняя сборка для этого адреса.'); return id; } return legacyNativeId(id); }

export function continuity(old: Obj[], signature: string, used: Set<number>) { const candidates = old.filter(x => x.signature === signature && !used.has(x.publicId)); return candidates.length === 1 ? candidates[0].publicId : null; }
/** Match the whole dataset before assigning IDs: a repeated row is never resolved by scan order. */
export async function prepareLegacy(db: Db, apply: boolean, progress: (message: string) => void = () => {}, onBinding?: (publicId:number,nativeId:number)=>void) {
    const ds=rules().datasetRevision;
    if(await db.collection('readerLegacyDatasets').findOne({_id:ds as any,status:'ready'}))return {datasetRevision:ds,existing:true};
    const identities=db.collection<any>('readerLegacyIdentities'),bindings=db.collection<any>('readerLegacyBindings');
    const all=await identities.find({},{projection:{publicId:1,signature:1,context:1}}).toArray();
    const previous=await db.collection<any>('readerLegacyDatasets').findOne({status:'ready'},{sort:{preparedAt:-1,_id:1}});
    const prior=previous?await bindings.find({datasetRevision:previous._id}).toArray():[];
    const byId=new Map(all.map(row=>[row.publicId,row]));
    // Match the most recent signatures, not only the originally imported spelling.
    const old:Obj[]=previous?prior.map(row=>({...byId.get(row.publicId),...row})):all;
    const current:Obj[]=[];let unresolved=0;
    for(const row of scanRows()){
        let body:Obj;try{body=resolvedRow(row);}catch{unresolved++;body={raw:'',ref:{namespace:'unresolved'}};}
        current.push({nativeId:row.item_id,signature:signatureOf(row,body),context:contextOf(row)});
    }
    const initial=all.length===0,assigned=new Map<number,number>(),used=new Set<number>();
    const match=(key:(row:Obj)=>string)=>{
        const left=new Map<string,Obj[]>(),right=new Map<string,Obj[]>();
        for(const row of old)if(!used.has(row.publicId)){const k=key(row);const rows=left.get(k)??[];rows.push(row);left.set(k,rows);}
        for(const row of current)if(!assigned.has(row.nativeId)){const k=key(row);const rows=right.get(k)??[];rows.push(row);right.set(k,rows);}
        for(const [k,rows]of right){const candidates=left.get(k);if(rows.length===1&&candidates?.length===1){assigned.set(rows[0].nativeId,candidates[0].publicId);used.add(candidates[0].publicId);}}
    };
    if(!initial){match(row=>row.signature);match(row=>revision('ctx1',row.context));}
    let max=all.reduce((n,r)=>Math.max(n,r.publicId),0),count=0;
    if(apply){await identities.createIndex({publicId:1},{unique:true});await identities.createIndex({signature:1});await bindings.createIndex({datasetRevision:1,nativeId:1},{unique:true});}
    let batch:any[]=[],newRows:any[]=[];
    async function flush(){if(apply&&batch.length){await identities.bulkWrite(newRows,{ordered:false});await bindings.bulkWrite(batch,{ordered:false});}batch=[];newRows=[];}
    for(const row of current){
        const publicId=initial?row.nativeId:assigned.get(row.nativeId)??++max;max=Math.max(max,publicId);
        const identity={publicId,signature:row.signature,context:row.context,firstDataset:ds};
        newRows.push({updateOne:{filter:{_id:String(publicId)},update:{$setOnInsert:{_id:String(publicId),...identity}},upsert:true}});
        batch.push({updateOne:{filter:{_id:ds+':'+publicId},update:{$setOnInsert:{_id:ds+':'+publicId,datasetRevision:ds,publicId,nativeId:row.nativeId,signature:row.signature}},upsert:true}});
        onBinding?.(publicId,row.nativeId);count++;if(batch.length>=1000)await flush();if(count%10000===0)progress('legacy '+count);
    }
    await flush();if(apply)await db.collection<any>('readerLegacyDatasets').updateOne({_id:ds},{$set:{status:'ready',count,unresolved,preparedAt:new Date()}},{upsert:true});
    return {datasetRevision:ds,count,unresolved,initial};
}
export async function legacyDb() { const { default: client } = await import('@/lib/mongodb'); return (await client).db('typikon'); }
export async function legacyNativeId(publicId: number, db?: Db): Promise<number> {
    const store = db ?? await legacyDb(); const enabled = await store.collection('readerPilots').findOne({ _id: 'cs-mvp-pilot-01' as any }); if (!enabled?.activeRelease || enabled.legacyRegistryActive === false) return publicId;
    const ds = rules().datasetRevision; const binding = await store.collection<any>('readerLegacyBindings').findOne({ _id: ds + ':' + publicId }); if (binding) return binding.nativeId;
    const known = await store.collection<any>('readerLegacyIdentities').findOne({ _id: String(publicId) });
    if (known) fail('ambiguous', 409, 'Прежний адрес не сопоставлен с текущей сборкой.'); fail('not_found', 404, 'Публичный ID не найден.');
}
export async function legacyPublicIds(nativeIds: number[], db?: Db): Promise<Map<number, number>> {
    const store = db ?? await legacyDb(); const enabled = await store.collection('readerPilots').findOne({ _id: 'cs-mvp-pilot-01' as any }); if (!enabled?.activeRelease || enabled.legacyRegistryActive === false) return new Map(nativeIds.map(id => [id, id]));
    const rows = await store.collection<any>('readerLegacyBindings').find({ datasetRevision: rules().datasetRevision, nativeId: { $in: nativeIds } }).toArray(); const result = new Map<number, number>(rows.map(r => [r.nativeId, r.publicId])); if (nativeIds.some(id => !result.has(id))) fail('corpus_unavailable', 503, 'Для сборки не подготовлены публичные адреса.'); return result;
}
export async function publicChant(row: Obj): Promise<Obj> { const ids = [row.id, ...(row.textItemId == null ? [] : [row.textItemId])]; const map = await legacyPublicIds(ids); return { ...row, id: map.get(row.id), textItemId: row.textItemId == null ? null : map.get(row.textItemId) }; }
