import type { WorkView, WorkOptions } from "./work";
import type { ParallelWork, ParallelWitness, ParallelGroup } from "./parallelTypes";
export interface AlignedParallel { witness: ParallelWitness; mapping: ReadonlyMap<number, ParallelGroup>; matches?: ReadonlyMap<number, "exact" | "text-family" | "context-text">; score: number }
export interface TargetPosition { block: number; position: number; neumes: string; text: string; barrier?: boolean }
/** Only for alignment; never supplies a musical realization or replaces exact neume keys. */
export function alignmentFamily(raw: string): string {
    return raw.replace(/\([^()]*\)/gu, "").replace(/^(?:[ГНцгнсмпвМПВ][#@]?)+/u, "").replace(/^[ртбулк]+/u, "").replace(/['^`]/gu, "");
}
export async function alignParallels(view: WorkView, target: readonly TargetPosition[], work: ParallelWork | undefined, options: WorkOptions): Promise<AlignedParallel[]> {
    if (!work) return [];
    const { normalizeNeumes, unicodeSlavonic, selectTextVariant } = await import("@znamenica/kruczie");
    const textKeys = (raw: string) => new Set((["original","normalized"] as const).map(mode => unicodeSlavonic(selectTextVariant(raw,mode).value ?? raw).normalize("NFD").toLowerCase().replace(/0/gu,"о").replace(/[ѣѧѹꙋѡѻꙗі]/gu,c=>({"ѣ":"е","ѧ":"я","ѹ":"у","ꙋ":"у","ѡ":"о","ѻ":"о","ꙗ":"я","і":"и"})[c]!).replace(/[^\p{L}]/gu,"")).filter(Boolean));
    const describe = (cell: { neumes: string; text: string }) => ({ exact:normalizeNeumes(cell.neumes),family:alignmentFamily(normalizeNeumes(cell.neumes)),text:textKeys(cell.text) });
    const a = target.map(describe), beginning = view.file.lines.find(line=>line.name === "начало")?.range.end ?? 0;
    const witnesses = work.witnesses.filter(w=>w.tradition===options.tradition && (options.tone===undefined || w.tone===options.tone) && (!options.corpusSourceId || w.sourceId===options.corpusSourceId));
    const output: AlignedParallel[] = [];
    for (const witness of witnesses) {
        const b = witness.groups.map(describe), width = b.length+1;
        if (a.length*b.length>1000000) continue;
        const scores = new Int32Array((a.length+1)*width), trace = new Uint8Array(scores.length);
        for(let i=1;i<=a.length;i++) {scores[i*width]=-3*i;trace[i*width]=2;}
        const relationship = (i:number,j:number) => ({ exact:!!a[i].exact && a[i].exact!=="_" && a[i].exact===b[j].exact, family:!!a[i].family && a[i].family===b[j].family, text:[...a[i].text].some(t=>b[j].text.has(t)) });
        for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++) {
            const r=relationship(i-1,j-1), valid=!target[i-1].barrier && view.file.blocks[target[i-1].block].range.start>=beginning;
            const diagonal=scores[(i-1)*width+j-1]+(valid ? (r.exact?5:0)+(r.family?2:0)+(r.text?7:0)-(!r.exact&&!r.family&&!r.text?5:0) : -8);
            const skipTarget=scores[(i-1)*width+j]-3, skipSource=scores[i*width+j-1]-3;
            scores[i*width+j]=Math.max(diagonal,skipTarget,skipSource);
            trace[i*width+j]=diagonal>=skipTarget&&diagonal>=skipSource?1:skipTarget>=skipSource?2:3;
        }
        let j=0;for(let k=1;k<=b.length;k++)if(scores[a.length*width+k]>scores[a.length*width+j])j=k;
        const score=scores[a.length*width+j], provisional=new Map<number,{source:number;strong:boolean;text:boolean;match:"exact"|"text-family"|"context-text"}>();
        for(let i=a.length;i>0&&j>0;) {
            const direction=trace[i*width+j];
            if(direction===1) {const r=relationship(i-1,j-1);if(!target[i-1].barrier && view.file.blocks[target[i-1].block].range.start>=beginning && (r.exact||r.text))provisional.set(i-1,{source:j-1,strong:r.exact||r.text&&r.family,text:r.text,match:r.exact?"exact":r.text&&r.family?"text-family":"context-text"});i--;j--;}
            else if(direction===2)i--;else j--;
        }
        const mapping=new Map<number,ParallelGroup>(), matches=new Map<number,"exact"|"text-family"|"context-text">();
        for(const [i,item] of provisional) {
            const near=[i-2,i-1,i+1,i+2].some(k=>{const n=provisional.get(k);return n?.strong && Math.abs(n.source-item.source)<=3;});
            if(item.strong||item.text&&near) {mapping.set(i,witness.groups[item.source]);matches.set(i,item.match);}
        }
        if(mapping.size>=2)output.push({witness,mapping,matches,score});
    }
    return output.sort((a,b)=>b.score-a.score||a.witness.id.localeCompare(b.witness.id,"en"));
}
