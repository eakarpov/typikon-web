import type {Relation} from './types';
/** Enrichment is disposable; persisted editorial accept/reject decisions take precedence. */
export function mergeRelations(proposals:Relation[],reviewed:Relation[],rejectedIds:string[]):Relation[]{
 const rejected=new Set(rejectedIds);
 const merged=new Map(proposals.filter(r=>r.status==='proposed'&&!rejected.has(r.id)).map(r=>[r.id,r]));
 for(const r of reviewed)merged.set(r.id,r);
 return [...merged.values()];
}
