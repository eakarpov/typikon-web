import type {Collection} from 'mongodb';
export type GroupMembersStore=Pick<Collection<{userId:string;groups:string[];deletedAt?:Date|null;updatedAt:Date}>,'updateMany'>;
/** All operations are scoped to the owner. Names remain recoverable in the trash. */
export async function removeGroupMembers(store:GroupMembersStore,userId:string,groupId:string,deletePersons:boolean,now=new Date()) {
    let removed=0;
    if(deletePersons) {
        const result=await store.updateMany({userId,groups:groupId,deletedAt:null},{$set:{deletedAt:now,updatedAt:now}});
        removed=result.modifiedCount;
    }
    await store.updateMany({userId,groups:groupId},{$pull:{groups:groupId},$set:{updatedAt:now}});
    return removed;
}
export function groupDeletionSettings(stored:{commemorations?:Record<string,any>;readingPlace?:any},groupId:string,deletedIds:readonly string[]) {
    const fields:Record<string,unknown>={};
    for(const [place,choice] of Object.entries(stored.commemorations??{})) {
        if(choice?.mode==='group'&&choice.group===groupId)fields[`commemorations.${place}`]={mode:'none'};
    }
    if(stored.readingPlace?.group===groupId||deletedIds.includes(stored.readingPlace?.personId))fields.readingPlace=null;
    return fields;
}
