import clientPromise from '@/lib/mongodb';
import { applyOperation, createState, ensureCycle, cycleAt, CircleError, validateConfig, type CircleState, type Operation,availablePresets } from './core';
import { assembleCycle,getCatalog } from './assembly';
const collection=async()=> (await clientPromise).db('typikon-users').collection<CircleState & {_id:string}>('prayerCircles');
export async function readCircle(userId:string,cycle?:string):Promise<CircleState|null> {
    const doc=await (await collection()).findOne({_id:userId});if(!doc)return null;
    const {_id,...state}=doc;
    ensureCycle(state,cycle??cycleAt(new Date(),state.config.timeZone));
    return state;
}
export async function writeCircle(userId:string,raw:unknown,create=false):Promise<CircleState> {
    const b=raw as Record<string,unknown>;const col=await collection();
    if(create) {
        const s=createState(validateConfig(b?.config));
        if(typeof b?.cycle!=='string')throw new CircleError('Не указана дата.');
        const snapshot=ensureCycle(s,b.cycle);
        const known=new Set(s.config.variants.flatMap(v=>v.blocks).map(b=>b.id));
        const cursors=b.cursors as Record<string,unknown>|undefined;
        for(const [id,value] of Object.entries(cursors??{}))if(known.has(id)&&Number.isInteger(value)&&Number(value)>=0&&Number(value)<60){s.cursors[id]=Number(value);snapshot.cursors[id]=Number(value);}
        if(b.psalterCursor!==undefined){if(!Number.isInteger(b.psalterCursor)||Number(b.psalterCursor)<0||Number(b.psalterCursor)>59)throw new CircleError('Неверное место Псалтири.');s.psalterCursor=Number(b.psalterCursor);}
        const progress=b.progress as Record<string,any>|undefined;
        for(const [id,value] of Object.entries(progress?.marks??{}))if(typeof value==='boolean'){
            if(known.has(id))snapshot.marks[id]=value;
            else if(id.startsWith('communion:'+s.config.communion?.date+':')){snapshot.marks[id]=value;s.communionMarks[id]=value;}
        }
        if(typeof progress?.bookmark==='string'&&progress.bookmark.length<=240)snapshot.bookmark=progress.bookmark;
        try {await col.insertOne({_id:userId,...s});}catch(e){if((e as {code?:number}).code===11000)throw new CircleError('В аккаунте уже есть круг. Выберите перенос или существующий вариант.',409);throw e;}
        return s;
    }
    const d=await col.findOne({_id:userId});if(!d)throw new CircleError('Сначала сохраните круг.',404);
    const {_id,...s}=d;if(s.receipts.includes(String(b.id)))return s;let operation=b as Operation;
    if(b.action==='override'&&b.templateId!==undefined){
        const template=availablePresets(await getCatalog()).find(t=>t.id===b.templateId);
        if(!template)throw new CircleError('Последование ещё не проверено или недоступно.');
        operation={...operation,template};
    }
    const next=applyOperation(s,operation);
    if(next===s)return s;
    if(!(await col.replaceOne({_id:userId,revision:s.revision},next)).matchedCount)throw new CircleError('Круг изменился на другом устройстве. Обновите данные.',409);
    return next;
}
export async function previewCircle(raw:unknown,userId?:string) {
    const b=raw as Record<string,any>;
    const config=validateConfig(b?.config);const s=createState(config);const cycle=ensureCycle(s,b?.cycle);
    if(b?.progress && typeof b.progress==='object') {
        for(const key of ['marks','counters','cursors','overrides'] as const) {
            const v=b.progress[key];if(v&&typeof v==='object'&&!Array.isArray(v)) (cycle as any)[key]=v;
        }
        if(typeof b.progress.bookmark==='string')cycle.bookmark=b.progress.bookmark;
    }
    // Guest payloads are never trusted as text, URLs, user IDs, or corpus editions.
    for(const v of Object.values(cycle.cursors))if(!Number.isInteger(v)||v<0||v>=60)throw new CircleError('Неверное место чтения.');
    if(Object.keys(cycle.overrides).some(k=>!['morning','evening','day'].includes(k))||Object.values(cycle.overrides).some(id=>!config.variants.some(v=>v.id===id)))throw new CircleError('Неверный вариант дня.');
    return assembleCycle(cycle,userId);
}
