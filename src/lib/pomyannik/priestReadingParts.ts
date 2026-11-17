import {ObjectId, type Db} from 'mongodb';
import {QueueError, type ReadingPhase, type Reservation, type ServiceSlot} from './priestQueueRules';
export const READING_PHASES: ReadingPhase[] = ['living','departed'];
export const sourceId = (entry: Reservation) => entry.sourceNoteId ?? entry.noteId;
export function noteCounts(note: any): Partial<Record<ReadingPhase,number>> {
    const result: Partial<Record<ReadingPhase,number>> = {};
    for (const name of note.names ?? []) {
        const phase: ReadingPhase = name.kind === 'departed' ? 'departed' : 'living';
        result[phase] = (result[phase] ?? 0)+1;
    }
    if (!(note.names??[]).length && note.partCounts) {
        for (const phase of READING_PHASES) if (Number.isInteger(note.partCounts[phase]) && note.partCounts[phase]>0) result[phase]=note.partCounts[phase];
    }
    const keys = READING_PHASES.filter(p=>result[p]);
    if (keys.length===1 && (note.names??[]).length) result[keys[0]]=note.namesCount ?? result[keys[0]];
    return result;
}
export const notePartReadAt = (note: any, phase: ReadingPhase): Date | null => note.readParts?.[phase] ?? note.readAt ?? null;
export function pendingView(note: any) {
    const counts = noteCounts(note);
    const phases = READING_PHASES.filter(p=>counts[p]&&!notePartReadAt(note,p));
    return {...note,names:(note.names??[]).filter((n:any)=>phases.includes(n.kind==='departed'?'departed':'living')),
        namesCount:phases.reduce((n,p)=>n+counts[p]!,0)};
}
export function hydrateEntry(entry: Reservation, note: any): Reservation {
    if (entry.parts) return {...entry,sourceNoteId:sourceId(entry)};
    const parts: Reservation['parts'] = {};
    const counts = noteCounts(note);
    for (const phase of READING_PHASES) if (counts[phase] && (entry.readAt || !notePartReadAt(note,phase)))
        parts[phase]={namesCount:counts[phase]!,readAt:entry.readAt};
    return {...entry,sourceNoteId:sourceId(entry),parts};
}
export const unreadPart = (entry: Reservation, phase: ReadingPhase) => !!entry.parts?.[phase] && !entry.parts[phase]!.readAt;
export const partsReadAt = (parts: Reservation['parts']) => {
    const values=Object.values(parts??{});
    return values.length&&values.every(p=>p.readAt) ? new Date(Math.max(...values.map(p=>+p.readAt!))) : null;
};
export async function hydrateEntries(db: Db, slot: ServiceSlot) {
    const ids=[...new Set(slot.entries.map(sourceId))].filter(id=>/^[a-f0-9]{24}$/i.test(id));
    const notes=await db.collection('zapiski').find({_id:{$in:ids.map(id=>new ObjectId(id))}}).toArray();
    return slot.entries.map(e=>{const note=notes.find(n=>String(n._id)===sourceId(e));return note?hydrateEntry(e,note):e;});
}
export async function hydrateStoredSlot(db: Db, slot: ServiceSlot): Promise<ServiceSlot> {
    if (slot.entries.every(e=>!!e.parts)) return slot;
    for(let attempt=0;attempt<8;attempt++){
        const entries=await hydrateEntries(db,slot);
        const result=await db.collection<ServiceSlot>('priestServices').findOneAndUpdate({_id:slot._id,revision:slot.revision},{$set:{entries},$inc:{revision:1}},{returnDocument:'after'});
        if(result)return result;
        const current=await db.collection<ServiceSlot>('priestServices').findOne({_id:slot._id});
        if(!current)throw new QueueError('Служба не найдена');slot=current;
        if(slot.entries.every(e=>!!e.parts))return slot;
    }
    throw new QueueError('Очередь изменилась. Обновите экран','conflict');
}
/** Ledger first, original note second. Release is allowed only after this durable sync. */
export async function syncEntryReads(db: Db, entry: Reservation) {
    const id=sourceId(entry);if(!/^[a-f0-9]{24}$/i.test(id))return;
    const col=db.collection('zapiski'),original=await col.findOne({_id:new ObjectId(id)});if(!original)return;
    const hydrated=hydrateEntry(entry,original);
    const counts=noteCounts(original);
    if(!Object.keys(counts).length){
        for(const phase of READING_PHASES)if(hydrated.parts?.[phase])counts[phase]=hydrated.parts[phase]!.namesCount;
        const known=Object.values(counts).reduce((sum,n)=>sum+n,0);
        const only=READING_PHASES.filter(p=>counts[p]);
        if(original.kind==='proskomidia'&&only.length===1&&original.namesCount>known)
            counts[only[0]==='living'?'departed':'living']=original.namesCount-known;
    }
    if(Object.keys(counts).length) await col.updateOne({_id:original._id,partCounts:{$exists:false}},{$set:{partCounts:counts}});
    for(const phase of READING_PHASES){const at=hydrated.parts?.[phase]?.readAt;
        if(at)await col.updateOne({_id:original._id,[`readParts.${phase}`]:null},{$set:{[`readParts.${phase}`]:at}});
    }
    const current=await col.findOne({_id:original._id});if(!current)return;
    const phases=READING_PHASES.filter(p=>noteCounts(current)[p]);
    if(phases.length&&phases.every(p=>notePartReadAt(current,p)))
        await col.updateOne({_id:original._id,readAt:null},{$set:{readAt:new Date(Math.max(...phases.map(p=>+notePartReadAt(current,p)!)))}});
}
export function archiveReadEntry(entry: Reservation, slotId: string): Reservation | null {
    if(!entry.parts)return entry.readAt?entry:null;
    const parts=Object.fromEntries(Object.entries(entry.parts).filter(([,p])=>p?.readAt)) as Reservation['parts'];
    if(!Object.keys(parts!).length)return null;
    if(Object.keys(parts!).length===Object.keys(entry.parts).length)return {...entry,readAt:partsReadAt(parts)};
    // Free the whole-note admission key, while retaining the already read part.
    // Its durable original readParts prevents that part from being assigned again.
    return {...entry,noteId:`${sourceId(entry)}:read:${slotId}`,sourceNoteId:sourceId(entry),parts,
        namesCount:Object.values(parts!).reduce((n,p)=>n+p.namesCount,0),readAt:partsReadAt(parts)};
}

export async function readableEntries(db: Db, slot: ServiceSlot): Promise<Reservation[]> {
    const ids=[...new Set(slot.entries.map(sourceId))].filter(id=>/^[a-f0-9]{24}$/i.test(id));
    const notes=await db.collection('zapiski').find({_id:{$in:ids.map(id=>new ObjectId(id))},sweptAt:null},{projection:{_id:1}}).toArray();
    const available=new Set(notes.map(n=>String(n._id)));return slot.entries.filter(e=>available.has(sourceId(e)));
}
