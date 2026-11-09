import {ObjectId} from 'mongodb';
import {randomBytes} from 'node:crypto';
import {notesCollection} from '@/lib/notes/sharing';
import {validateNote, ownNote, publicNote, type PersonalNote} from './notes';

function external(d: any): PersonalNote {
  return {id:String(d._id),userId:d.userId,...d.companion,text:d.note,revision:d.revision??0,sharingRevision:d.sharingRevision??0,shareToken:d.shareToken??null,updatedAt:new Date(d.updatedAt).toISOString()};
}
export async function listNotes(userId:string,sessionKey:string,nodeId:string) {
  const rows=await(await notesCollection()).find({userId,deleted:{$ne:true},'companion.sessionKey':sessionKey,'companion.nodeId':nodeId}).sort({updatedAt:-1}).limit(100).toArray();
  return rows.map(d=>ownNote(external(d)));
}
export async function saveNote(userId:string,raw:unknown) {
  const b=validateNote(raw);if(!/^[a-f0-9]{24}$/i.test(b.id))throw Error('Неверный адрес заметки.');
  const col=await notesCollection(),_id=new ObjectId(b.id),d=await col.findOne({_id,userId,deleted:{$ne:true}}),old=d?external(d):null;
  if(old&&old.revision===b.expectedRevision+1&&!!old.shareToken===b.published&&['sessionKey','nodeId','contentHash','title','nodeTitle','text'].every(k=>old[k as keyof PersonalNote]===b[k as keyof typeof b])&&JSON.stringify(old.selection)===JSON.stringify(b.selection))return ownNote(old);
  if((old?.sharingRevision??0)!==b.expectedSharingRevision)throw Error('conflict');
  if((old?.revision??0)!==b.expectedRevision)throw Error('conflict');
  if(old&&(old.sessionKey!==b.sessionKey||old.nodeId!==b.nodeId))throw Error('Неверное место заметки.');
  const {id,text,published,expectedRevision,expectedSharingRevision,...companion}=b,now=new Date();
  const record={...d,_id,userId,note:text,companion,textId:'companion:'+b.sessionKey,selection:{type:'companion',phrase:b.nodeTitle},kind:'note',revision:expectedRevision+1,sharingRevision:expectedSharingRevision+(!!old?.shareToken!==published?1:0),shareToken:published?old?.shareToken??randomBytes(24).toString('hex'):null,updatedAt:now,createdAt:d?.createdAt??now};
  if(!d){try{await col.insertOne(record);}catch(e){if((e as {code?:number}).code===11000)throw Error('conflict');throw e;}}
  else {const {_id:unused,...replacement}=record;if(!(await col.replaceOne({_id,userId,revision:expectedRevision,...(d.sharingRevision===undefined?{sharingRevision:{$exists:false}}:{sharingRevision:expectedSharingRevision})},replacement)).matchedCount)throw Error('conflict');}
  return ownNote(external(record));
}
export async function readSharedNote(token:string) {
  if(!/^[a-f0-9]{48}$/.test(token))return null;
  const d=await(await notesCollection()).findOne({shareToken:token,deleted:{$ne:true},companion:{$exists:true}});
  return d?publicNote(external(d)):null;
}
