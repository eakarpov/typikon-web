/** Verse numbers use the edition's canonical mapping, including supplied verses. */
export function missingVerses(available:number[],from:number,to?:number) {
    const present=new Set(available),end=to??Math.max(0,...available);
    if(!available.length||from>end)return [from];
    return Array.from({length:end-from+1},(_,i)=>from+i).filter(n=>!present.has(n));
}
