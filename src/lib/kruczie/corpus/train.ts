import type { NgramModel, NgramEntry, NgramRealization, NgramCounts, NgramContext, NgramExample } from "@znamenica/kruczie/ngrams";
import type { ChantCollection } from "./types";
import { createCorpusIndex } from "./training";
/** Offline training stays in the portal; the npm module receives only learned counts. */
export async function trainNgramModel(collection: ChantCollection): Promise<NgramModel> {
    const index = await createCorpusIndex(collection);
    const neumes: string[] = [], notes: string[] = [], contexts: NgramContext[] = [];
    const nids = new Map<string,number>(), mids = new Map<string,number>(), cids = new Map<string,number>();
    const id = (value: string, list: string[], ids: Map<string,number>) => { let result=ids.get(value);if(result===undefined){result=list.length;list.push(value);ids.set(value,result);}return result; };
    const sources = [...new Map([...collection.witnesses.map(w=>({id:w.sourceId,title:w.sourceId})), ...collection.sources].map(s=>[s.id,s])).values()], sourceIds = new Map(sources.map((s,i)=>[s.id,i]));
    const documents = collection.witnesses.map(w=>({ witnessId:w.id,workId:w.workId,sourceId:w.sourceId,url:w.url,...(w.tone ? {tone:w.tone}:{}),toneEvidence:w.toneEvidence })), dids = new Map(documents.map((d,i)=>[d.witnessId,i]));
    const entries: NgramEntry[] = [];
    for (const [key, observations] of index.windows) {
        const groups: string[] = JSON.parse(key), byRealization = new Map<string,{notes:readonly string[];counts:NgramCounts[]}>();
        const scopes = new Map<string,NgramContext>();
        for (const o of observations) for (const source of [undefined,...new Set(o.refs.map(r=>r.sourceId))]) for (const tone of o.tone === undefined ? [undefined] : [undefined,o.tone]) {
            const context = { tradition:o.tradition as NgramContext["tradition"], ...(tone === undefined ? {} : {tone:tone as NgramContext["tone"]}), ...(source === undefined ? {} : {sourceId:source}) };
            scopes.set(JSON.stringify([context.tradition,context.tone??null,context.sourceId??null]),context);
        }
        for (const [ckey,context] of scopes) {
            let contextId=cids.get(ckey);if(contextId===undefined){contextId=contexts.length;contexts.push(context);cids.set(ckey,contextId);}
            const unique = new Map<string,typeof observations[number]>();
            for (const o of observations) {
                if (o.tradition !== context.tradition || (context.tone !== undefined && o.tone !== context.tone))continue;
                const refs=o.refs.filter(r=>context.sourceId===undefined || r.sourceId===context.sourceId);if(!refs.length)continue;
                const old=unique.get(o.occurrence);if(old)old.refs.push(...refs);else unique.set(o.occurrence,{...o,refs:[...refs]});
            }
            const values=[...unique.values()], variants=new Map<string,typeof values>();
            for(const value of values){const list=variants.get(value.noteKey)??[];list.push(value);variants.set(value.noteKey,list);}
            for(const [music,hits] of variants){
                const item=byRealization.get(music)??{notes:hits[0].notes,counts:[]};
                const refs=hits.flatMap(o=>o.refs), sids=[...new Set(refs.map(r=>sourceIds.get(r.sourceId)!))].sort((a,b)=>a-b);
                const examples:NgramExample[]=refs.slice(0,2).map<NgramExample>(r=>r.recovery ? [dids.get(r.witnessId)!,r.block,r.position,r.recovery === "music-only" ? 2 : 1] : [dids.get(r.witnessId)!,r.block,r.position]);
                item.counts.push([contextId,hits.length,values.length,new Set(hits.map(o=>o.cluster)).size,sids,examples]);byRealization.set(music,item);
            }
        }
        const realizations:NgramRealization[]=[...byRealization.values()].map(value=>[value.notes.map(note=>id(note,notes,mids)),value.counts]);
        entries.push([groups.map(group=>id(group,neumes,nids)),realizations]);
    }
    return { schemaVersion:1,version:collection.version,neumes,notes,contexts,sources,documents,entries,
        training:{witnessCount:index.witnessCount,workCount:collection.works.length,acceptedPositions:collection.samples.reduce((n,s)=>n+s.positions.length,0),excludedBlocks:collection.audit.rejectedBlocks,rightsUrl:"http://znamen.ru/org.php#usl",method:"N=1,2,3; exact aligned double notation; full-copy deduplication; source/tone strata; rhythm retained; no inferred syllable splitting; verified contiguous segments from problematic blocks; music-only alignment when text differs; gaps never bridged; opaque neume keys retained when musical layers align; placeholders excluded"} };
}
