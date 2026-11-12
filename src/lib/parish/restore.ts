import type {ParishEdit} from './editModel';
type CancellationFilter=Pick<ParishEdit,'parishSlug'|'date'|'gatheringKey'> & {op:'cancel'};
export interface CancellationStore {deleteMany(filter:CancellationFilter):Promise<{deletedCount:number}>}
/** Снимает только отмены этого собрания. Part намеренно не ограничен:
 * после отмены ведущий мог перенести службу в другую часть суток. */
export async function restoreCancelled(store:CancellationStore,parishSlug:string,date:string,gatheringKey:string){
 return store.deleteMany({parishSlug,date,gatheringKey,op:'cancel'});
}
