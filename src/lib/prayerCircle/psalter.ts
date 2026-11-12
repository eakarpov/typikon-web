import type { BlockResult, Row } from './core';
export interface PsalterPart { psalm:number; from:number; to:number; statia:number }
/** Граница статии определяется данными корпуса, а не числом псалмов. */
export async function buildPsalterParts(parts:PsalterPart[],prefix:string,loaders:{
    verses:(part:PsalterPart)=>Promise<BlockResult>;
    slava:()=>Promise<BlockResult>;
    names:(statia:number)=>Promise<BlockResult>;
}):Promise<BlockResult> {
    const rows:Row[]=[],missing:string[]=[];
    for(let i=0;i<parts.length;i++) {
        const part=parts[i],reading=await loaders.verses(part);
        missing.push(...reading.missing);
        if(!reading.rows.length) missing.push(`Не удалось загрузить псалом ${part.psalm}.`);
        rows.push(...reading.rows.map(row=>({...row,id:`${prefix}:${part.psalm}:${row.id}`})));
        if(i===parts.length-1||part.statia!==parts[i+1].statia) {
            const slava=await loaders.slava(),names=await loaders.names(part.statia);
            missing.push(...slava.missing,...names.missing);
            rows.push(...slava.rows.map((row,j)=>({...row,id:`${prefix}:slava:${part.statia}:${j}`})),
                ...names.rows.map((row,j)=>({...row,id:`${prefix}:names:${part.statia}:${j}`})));
        }
    }
    return {rows,missing};
}
