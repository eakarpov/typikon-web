import {GroupError, type PomyannikGroup} from './groups';
export const UNGROUPED = '__ungrouped__';
export function orderedGroups(groups:PomyannikGroup[], order:readonly string[]):PomyannikGroup[] {
    const positions=new Map(order.map((id,i)=>[id,i]));
    return [...groups].sort((a,b)=>(positions.get(a.id)??Infinity)-(positions.get(b.id)??Infinity)||a.name.localeCompare(b.name,'ru'));
}
export function validateGroupOrder(raw:unknown, groups:readonly PomyannikGroup[]):string[] {
    if(!Array.isArray(raw)||raw.some(id=>typeof id!=='string')||new Set(raw).size!==raw.length||raw.length!==groups.length||raw.some(id=>!groups.some(g=>g.id===id)))
        throw new GroupError('Список групп изменился. Обновите помянник и повторите.');
    return raw;
}
export function groupPriority(groups:readonly string[], order:readonly string[]):number {
    const priorities=groups.map(id=>order.indexOf(id)).filter(i=>i>=0);
    return priorities.length?Math.min(...priorities):order.length;
}
/** Стабильная сортировка: группа раньше ручного порядка имён. */
export function prioritizePersons<T extends {groups:string[]}>(persons:readonly T[], order:readonly string[]):T[] {
    return [...persons].sort((a,b)=>groupPriority(a.groups,order)-groupPriority(b.groups,order));
}
