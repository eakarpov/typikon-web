import type {Rank} from './types';
export const AGE_RANKS:readonly Rank[]=['mladenets','otrok','otrokovitsa'];
type Aged={rank?:Rank|null;born?:string|null;died?:string|null;kind?:string;sex?:string|null};
export function personAge(p:Aged,on:string):number|null {
    const until=p.kind==='departed'?p.died:on;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(p.born??'')||!/^\d{4}-\d{2}-\d{2}$/.test(until??'')||p.born!>until!)return null;
    const [by,bm,bd]=p.born!.split('-').map(Number),[y,m,d]=until!.split('-').map(Number);
    return y-by-(m<bm||(m===bm&&d<bd)?1:0);
}
export function rankSuitsSex(rank:Rank|null|undefined,sex?:string|null):boolean {
    return rank==='otrok'?sex==='m':rank==='otrokovitsa'?sex==='f':true;
}
/** A known age governs age labels; other explicitly chosen statuses are retained. */
export function effectiveStatusRank(p:Aged,on:string):Rank|null {
    if(p.rank&&!AGE_RANKS.includes(p.rank))return p.rank;
    const age=personAge(p,on);
    if(age===null)return rankSuitsSex(p.rank,p.sex)?p.rank??null:null;
    if(age<7)return 'mladenets';
    if(age<14)return p.sex==='m'?'otrok':p.sex==='f'?'otrokovitsa':null;
    return null;
}
export function validateLifeDates(p:Aged):void {
    if(p.kind!=='departed')return;
    const datedYear=/^(\d{4})(?:-\d{2}-\d{2})?$/;
    const born=datedYear.exec(p.born??''),died=datedYear.exec(p.died??'');
    if(!born||!died)return;
    if(Number(died[1])<Number(born[1]) || p.born!.length===10&&p.died!.length===10&&p.died!<p.born!)throw new Error('Дата преставления не может быть раньше даты рождения.');
}
