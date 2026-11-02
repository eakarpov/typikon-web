import clientPromise from '@/lib/mongodb';
import {applyProgress,initialProgress,type Progress,type Operation} from './core';
const collection=async()=>(await clientPromise).db('typikon-users').collection<Progress&{_id:string}>('companionProgress');
export async function readProgress(userId:string):Promise<Progress>{const d=await(await collection()).findOne({_id:userId});if(!d)return initialProgress();const {_id,...state}=d;return state;}
export async function writeProgress(userId:string,op:Operation):Promise<Progress>{
 const col=await collection();let d=await col.findOne({_id:userId});if(!d){try{await col.insertOne({_id:userId,...initialProgress()});}catch(e){if((e as {code?:number}).code!==11000)throw e;}d=await col.findOne({_id:userId});}
 const {_id,...state}=d!;const next=applyProgress(state,op);if(next===state)return state;
 if(!(await col.replaceOne({_id:userId,revision:state.revision},next)).matchedCount)throw Error('conflict');return next;
}
