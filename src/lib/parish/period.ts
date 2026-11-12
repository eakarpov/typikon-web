export type SchedulePeriodType='month'|'week';
const DAY=86400000;
const iso=(date:Date)=>date.toISOString().slice(0,10);
export function isoWeekKey(value:string|Date):string{
    const date=new Date(typeof value==='string'?value+'T12:00:00Z':value);
    date.setUTCHours(0,0,0,0);
    date.setUTCDate(date.getUTCDate()+4-(date.getUTCDay()||7));
    const year=date.getUTCFullYear(),first=new Date(Date.UTC(year,0,1));
    return `${year}-W${String(Math.ceil(((+date-+first)/DAY+1)/7)).padStart(2,'0')}`;
}
export interface SchedulePeriod {key:string;type:SchedulePeriodType;start:string;end:string;dates:string[];label:string}
export function schedulePeriod(key:string):SchedulePeriod|null{
    const monthly=/^(\d{4})-(\d{2})$/.exec(key),weekly=/^(\d{4})-W(\d{2})$/.exec(key);
    let start:Date,end:Date,type:SchedulePeriodType;
    const year=Number((monthly??weekly)?.[1]);if(year<1900||year>2199)return null;
    if(monthly){
        const month=Number(monthly[2]);if(month<1||month>12)return null;
        start=new Date(Date.UTC(year,month-1,1));end=new Date(Date.UTC(year,month,0));type='month';
    }else if(weekly){
        const week=Number(weekly[2]);if(week<1||week>53)return null;
        const fourth=new Date(Date.UTC(year,0,4));
        start=new Date(+fourth+((week-1)*7-(fourth.getUTCDay()||7)+1)*DAY);
        if(isoWeekKey(start)!==key)return null;
        end=new Date(+start+6*DAY);type='week';
    }else return null;
    const dates=[];for(let at=+start;at<=+end;at+=DAY)dates.push(iso(new Date(at)));
    const format=(date:Date)=>date.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
    const label=type==='month'?start.toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}):`${format(start)} — ${format(end)}`;
    return {key,type,start:iso(start),end:iso(end),dates,label};
}
export function periodKeyForDate(date:string,type:SchedulePeriodType){return type==='week'?isoWeekKey(date):date.slice(0,7);}
export function shiftSchedulePeriod(key:string,direction:number):string{
    const period=schedulePeriod(key);if(!period)return key;
    const date=new Date(period.start+'T12:00:00Z');
    if(period.type==='week')date.setUTCDate(date.getUTCDate()+direction*7);else date.setUTCMonth(date.getUTCMonth()+direction);
    return periodKeyForDate(iso(date),period.type);
}
export function periodsBetween(from:Date,to:Date,type:SchedulePeriodType):string[]{
    const result:string[]=[];let key=periodKeyForDate(iso(from),type);
    for(let i=0;i<120;i++){
        const period=schedulePeriod(key);if(!period||period.start>iso(to))break;
        result.push(key);key=shiftSchedulePeriod(key,1);
    }
    return result;
}
export function parishScheduleHref(slug:string,key:string,edit=false,why=false){
    const params=new URLSearchParams();if(edit)params.set('edit','1');if(why)params.set('why','1');
    return `/parish/${encodeURIComponent(slug)}/schedule/${key}${params.size?'?'+params:''}`;
}
export function presentationDays<T>(live:T[],published:T[]|undefined,draft:boolean){return draft||!published?.length?live:published;}
