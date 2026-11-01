import type {Row} from './core';
/** Match occurrences in order; one repeated row cannot satisfy two readings. */
export function containsReading(read:Row[],required:Row[]) {
    const body=required.filter(r=>r.zone!=='opening'&&r.zone!=='closing'&&r.kind!=='heading');
    if(!body.length)return false;
    let after=0;
    return body.every(r=>{
        const index=read.findIndex((row,n)=>n>=after&&row.kind!=='heading'
            && (r.contentKey&&row.contentKey?r.contentKey===row.contentKey:row.text===r.text&&row.sourceBook===r.sourceBook&&(row.repeatCount??1)===(r.repeatCount??1)));
        if(index<0)return false;after=index+1;return true;
    });
}
