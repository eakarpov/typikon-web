import type { BlockResult, Row } from './core';
export interface PsalterPart { psalm:number; from:number; to:number; statia:number }
/** Старая версия сборщика опускает заключительное «Слава, и ныне».
 * Повторяем книжную строку со всеми сведениями об источнике; уже полный
 * разделитель не дополняем повторно. */
export function completePsalterSlava(result: BlockResult): BlockResult {
    const first = result.rows[0];
    if (!first || result.rows.at(-1)?.text === first.text) return result;
    return { ...result, rows: [...result.rows, { ...first, id: `${first.id}:closing` }] };
}
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
            const slava=completePsalterSlava(await loaders.slava()),names=await loaders.names(part.statia);
            missing.push(...slava.missing,...names.missing);
            rows.push(...slava.rows.map((row,j)=>({...row,id:`${prefix}:slava:${part.statia}:${j}`})),
                ...names.rows.map((row,j)=>({...row,id:`${prefix}:names:${part.statia}:${j}`})));
        }
    }
    return {rows,missing};
}
