import {shiftDate,type CircleConfig,type Part} from './core';

export function preparationSlot(plan:NonNullable<CircleConfig['communion']>,id:string,index:number,total:number):{date:string;part:Part} {
    if(id==='thanksgiving')return {date:plan.date,part:'day'};
    if(id==='prayers')return {date:plan.date,part:'morning'};
    if(plan.days===0)return {date:plan.date,part:'morning'};
    if(id==='service')return {date:shiftDate(plan.date,-1),part:'evening'};
    // Personal scheduling, not a church-wide requirement for a fixed duration.
    const days=Math.max(1,plan.days);
    const offset=days-Math.floor(index*days/Math.max(1,total));
    return {date:shiftDate(plan.date,-Math.max(1,offset)),part:'evening'};
}
export function dueInCycle(cycle:string,date:string,part:Part) {
    return date===(part==='evening'?cycle:shiftDate(cycle,1));
}
