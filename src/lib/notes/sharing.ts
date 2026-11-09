import {randomBytes} from 'node:crypto';
import {ObjectId} from 'mongodb';
import clientPromise from '@/lib/mongodb';
import {href, validateTarget} from '@/lib/study/core';
import {validateSelection} from '@/lib/companion/core';

let indexes: Promise<unknown> | undefined;
export const notesCollection = async () => {
  const col = (await clientPromise).db('typikon-users').collection('userNotes');
  if (!indexes) indexes = Promise.all([col.createIndex({userId:1,'companion.sessionKey':1,'companion.nodeId':1}),col.createIndex({shareToken:1},{unique:true,partialFilterExpression:{shareToken:{$type:'string'}}})]).catch(e=>{indexes=undefined;throw e;});
  await indexes;return col;
};
export function noteIdFilter(id: string) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{8,160}$/.test(id)) throw Error('Неверный адрес заметки.');
  return {$or:[{_id: ObjectId.isValid(id) ? new ObjectId(id) : id as any}, {id}]};
}
export async function noteForOwner(userId: string, id: string) {
  return (await notesCollection()).findOne({userId, deleted:{$ne:true}, ...noteIdFilter(id)});
}
export async function sharing(userId: string, raw: unknown) {
  const b = raw as {id:string;expectedRevision:number;published:boolean;expectedNoteRevision?:number};
  if (!b || typeof b.published !== 'boolean' || !Number.isSafeInteger(b.expectedRevision) || b.expectedRevision < 0) throw Error('Неверная настройка доступа.');
  const col = await notesCollection(), old = await noteForOwner(userId,b.id);
  if (!old) throw Error('not_found');
  if (b.published && b.expectedNoteRevision !== (old.revision ?? 0)) throw Error('conflict');
  if ((old.sharingRevision ?? 0) !== b.expectedRevision) {
    if (old.sharingRevision === b.expectedRevision + 1 && !!old.shareToken === b.published) return {id:b.id,revision:old.sharingRevision,published:!!old.shareToken,noteRevision:old.revision??0,shareToken:old.shareToken ?? null};
    throw Error('conflict');
  }
  const shareToken = b.published ? old.shareToken ?? randomBytes(24).toString('hex') : null;
  const version = old.sharingRevision === undefined ? {sharingRevision:{$exists:false}} : {sharingRevision:old.sharingRevision};
  const r = await col.updateOne({_id:old._id,userId,deleted:{$ne:true},...version,...(b.published?(old.revision===undefined?{revision:{$exists:false}}:{revision:old.revision}):{})},{$set:{shareToken,updatedAt:new Date()},$inc:{sharingRevision:1}});
  if (!r.matchedCount) throw Error('conflict');
  return {id:b.id,revision:(old.sharingRevision ?? 0)+1,published:!!shareToken,noteRevision:old.revision??0,shareToken};
}
export async function sharedNote(token: string) {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const n = await (await notesCollection()).findOne({shareToken:token,deleted:{$ne:true}});
  if (!n) return null;
  let source = {title:n.sourceTitle ?? n.textName ?? 'Текст',href:'',quote:String(n.originalQuote ?? n.selection?.phrase ?? '')};
  if (n.companion) {
    const c = n.companion, selection = validateSelection(c.selection);
    source = {title:c.title+' · '+c.nodeTitle,quote:'',href:'/companion?'+new URLSearchParams({...selection,node:c.nodeId})};
  } else if (n.target) {
    try {source.href = href(validateTarget(n.target));} catch {/* Preserve note without inventing an address. */}
  } else if (typeof n.textId === 'string' && /^[a-f0-9]{24}$/i.test(n.textId)) {
    source.href = '/reading/'+n.textId;
    const t = await (await clientPromise).db('typikon').collection('texts').findOne({_id:new ObjectId(n.textId)},{projection:{name:1}});
    if (t?.name) source.title = t.name;
  }
  // Explicit projection. Never expose owner, IDs, other notes or private cache.
  return {text:String(n.note ?? ''),source,updatedAt:new Date(n.updatedAt).toISOString()};
}
