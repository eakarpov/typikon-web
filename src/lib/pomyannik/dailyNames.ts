import {fullDate} from './dates';
export interface DailyNames {size:number;start:string}
export function cleanDailyNames(raw:unknown):DailyNames|undefined {
    if(raw===undefined||raw===null)return undefined;
    const value=raw as DailyNames;
    if(typeof raw!=='object'||Array.isArray(raw)||!Number.isInteger(value.size)||value.size<1||value.size>1000||!fullDate(value.start))throw new Error('Укажите от 1 до 1000 имён в дневной порции и дату начала.');
    return {size:value.size,start:value.start};
}
/** Fixed-size cyclic windows; a name occurs at most once within one day. */
export function dailyNames<T>(items:readonly T[],config:DailyNames|undefined,on:string):T[] {
    if(!config||items.length<=config.size)return [...items];
    const days=Math.max(0,Math.floor((Date.parse(on+'T00:00:00Z')-Date.parse(config.start+'T00:00:00Z'))/86400000));
    if(!Number.isFinite(days))return [];
    const offset=(days*config.size)%items.length;
    return Array.from({length:config.size},(_,i)=>items[(offset+i)%items.length]);
}
