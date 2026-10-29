import type { WorkView, WorkResult, WorkOptions } from "./work";
import type { ParallelWork, SequencePreference, ParallelRealization } from "./parallelTypes";
import { resolveMusicalGaps } from "./diagnostics";
import { alignParallels, type TargetPosition } from "./parallelAlignment";
import { searchCoherentSequences, comparePriorities } from "./sequenceRanking";
import { builtinCorpusIndex } from "./corpus/builtin";
import { getCorpusRealizations, scoreCorpusSequence } from "./corpus";
/** All physical lines are searched together; explicit gaps/end marks keep their musical boundaries. */
export async function rankWholeWork(view: WorkView, input: Readonly<Record<number,WorkResult>>,options:WorkOptions,parallel?:ParallelWork): Promise<Record<number,WorkResult>> {
    if(options.direction!=="to-notes")return {...input};
    const [{melodyKey,parseMelody},index]=await Promise.all([import("@znamenica/kruczie"),builtinCorpusIndex()]);
    const context={tradition:options.tradition,tone:options.tone,sourceId:options.corpusSourceId};
    const target:TargetPosition[]=[],available:string[][]=[];
    const beginning=view.file.lines.find(line=>line.name==="начало")?.range.end;
    let crossed=false;
    for(const [block,row] of view.blocks.entries()) {
        if(beginning!==undefined&&!crossed&&view.file.blocks[block].range.start>=beginning){target.push({block,position:-1,neumes:"",text:"",barrier:true});available.push([]);crossed=true;}
        if(!view.file.blocks[block].aligned || !input[block]){target.push({block,position:-1,neumes:"",text:"",barrier:true});available.push([]);continue;}
        for(const [position,cell] of row.cells.entries()) {
            const neumes=cell.syllable.notation?.raw??"",result=input[block];
            target.push({block,position,neumes,text:cell.syllable.text.raw});
            const raw=cell.syllable.melody ? [cell.syllable.melody.raw] : [...getCorpusRealizations(index,neumes,context),...(result?.positions?.find(p=>p.index===position)?.notes??[]),...(result?.candidates.flatMap(c=>c.syllables[position]?.melody?[c.syllables[position].melody!.raw]:[])??[])];
            available.push([...new Map(raw.map(n=>[melodyKey(n),n])).values()]);
        }
    }
    const parallels=await alignParallels(view,target,parallel?.version===index.model.version?parallel:undefined,options);
    const borrowedParallels = new Map<number,ParallelRealization[]>();
    for(const aligned of parallels) for(const [i,group] of aligned.mapping) {
        const match=aligned.matches?.get(i), principal=target[i].neumes.replace(/\([^()]*\)/gu,"");
        // A supplied pitch is never erased to create a fallback. Unpitched projection needs both text and family agreement.
        if(match!=="exact" && !(match==="text-family" && !/[ГНцгнсмпвМПВ]/u.test(principal)))continue;
        const record:ParallelRealization={position:target[i].position,notes:group.notes,sourceNeumes:group.neumes,sourceId:aligned.witness.sourceId,url:aligned.witness.url,sourceBlock:group.block,sourcePosition:group.position,match};
        if(!available[i].some(n=>melodyKey(n)===melodyKey(group.notes))) {available[i].push(group.notes);const list=borrowedParallels.get(i)??[];list.push(record);borrowedParallels.set(i,list);}
    }
    let limited=available.some(options=>options.length>16);
    const choices=target.map((cell,i)=>{
        const desired=new Set(parallels.flatMap(ref=>{const g=ref.mapping.get(i);return g?[melodyKey(g.notes)]:[];}));
        const values=[...available[i]].sort((a,b)=>Number(desired.has(melodyKey(b)))-Number(desired.has(melodyKey(a))));
        return {neumes:cell.neumes,options:values.slice(0,16)};
    });
    const search=searchCoherentSequences(index,choices,context,64,parallels),best=search.sequences[0];
    if(!best)return {...input};
    limited ||= search.truncated;
    let reference=-1;
    best.referenceStates.forEach((r,i)=>{const old=best.referenceStates[reference];if(!old||comparePriorities([r.long,r.exact,-r.distance],[old.long,old.exact,-old.distance])<0)reference=i;});
    const chosen=parallels[reference],state=best.referenceStates[reference];
    const output:Record<number,WorkResult>={...input};
    for(const [block,row] of view.blocks.entries()) {
        const old=input[block];if(!old||!view.file.blocks[block].aligned)continue;
        const globals=target.flatMap((cell,i)=>cell.block===block&&cell.position>=0?[i]:[]);
        const notes=globals.map(i=>best.groups[i].notes);
        const preference:SequencePreference={...best.ranking.preference!,scope:"work",...(chosen?{reference:{sourceId:chosen.witness.sourceId,workId:chosen.witness.workId,url:chosen.witness.url,tone:chosen.witness.tone,aligned:chosen.mapping.size,matched:state.exact,total:target.filter(c=>!c.barrier).length,positions:globals.flatMap(i=>{const g=chosen.mapping.get(i);return g?[{position:target[i].position,sourceBlock:g.block,sourcePosition:g.position,notes:g.notes,exact:!!best.groups[i].notes&&melodyKey(best.groups[i].notes!)===melodyKey(g.notes)}]:[]})}}:{})};
        const candidates=[...(old.recommendation?.ranking.fallbacks??[]),...(old.positions?.flatMap(p=>p.rankings?.flatMap(r=>r.fallbacks??[])??[])??[])];
        const borrowed=[...new Map(candidates.filter(f=>notes[f.position]&&melodyKey(notes[f.position]!)===melodyKey(f.notes)).map(f=>[`${f.position}:${melodyKey(f.notes)}`,f])).values()];
        const sourceRealizations=globals.flatMap(i=>(borrowedParallels.get(i)??[]).filter(p=>best.groups[i].notes&&melodyKey(p.notes)===melodyKey(best.groups[i].notes!)));
        const ranking={...best.ranking,preference,...(borrowed.length?{fallbacks:borrowed}:{}),...(sourceRealizations.length?{parallels:sourceRealizations}:{})};
        const positions=globals.flatMap(i=>{
            if(!choices[i].options.length)return [];
            const preferred=best.groups[i].notes;
            const sorted=[...choices[i].options].sort((a,b)=>Number(b===preferred)-Number(a===preferred));
            const previous=old.positions?.find(p=>p.index===target[i].position);
            return [{index:target[i].position,notes:sorted,melodies:sorted.map(n=>parseMelody(n).value!),rankings:sorted.map(n=>n===preferred?{...ranking,evidence:ranking.evidence.filter(e=>e.start<=i&&e.end>i),fallbacks:ranking.fallbacks?.filter(f=>f.position===target[i].position),parallels:ranking.parallels?.filter(p=>p.position===target[i].position),preference:{...preference,...(preference.reference?{reference:{...preference.reference,positions:preference.reference.positions.filter(p=>p.position===target[i].position)}}:{})}}:previous?.rankings?.[previous.notes.indexOf(n)]??scoreCorpusSequence(index,[{neumes:target[i].neumes,notes:n}],context))}];
        });
        output[block]={...old,positions,diagnostics:resolveMusicalGaps(old.diagnostics,notes.map(Boolean)),recommendation:{notes,ranking,truncated:limited||!!parallel?.truncated,tied:search.sequences.filter(s=>comparePriorities(s.ranking.preference!.priority,best.ranking.preference!.priority)===0).length}};
        void row;
    }
    return output;
}
