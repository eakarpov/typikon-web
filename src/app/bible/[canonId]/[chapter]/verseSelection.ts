/** Shared semantics for chapter query links and ordinary #vN anchors. */
export function verseSelection(search: string, hash: string): {first:number;last:number}|null {
 const parse=(raw:string|null)=>{const m=/^([1-9][0-9]*)(?:-([1-9][0-9]*))?$/.exec(raw??'');if(!m)return null;const first=Number(m[1]),last=Number(m[2]??m[1]);return Number.isSafeInteger(first)&&Number.isSafeInteger(last)&&first<=last&&last<=1000?{first,last}:null;};
 const selected=parse(new URLSearchParams(search).get('highlight'));
 const anchor=parse(/^#v([1-9][0-9]*)$/.exec(hash)?.[1]??null);
 if(anchor&&selected&&anchor.first===selected.first)return selected;
 return anchor??selected;
}
