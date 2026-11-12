import type { ParishDay } from './types';
export const SERVICE_SIGNS = [['bez-znaka', 'Без знака'], ['shesterichnaya', 'Шестеричная'], ['slavoslovie', 'Славословие'], ['polieley', 'Полиелей'], ['bdenie', 'Бдение'], ['velikoe-bdenie', 'Великое бдение']] as const;
export const SERVICE_CHOICES = [['moleben', 'Молебен'], ['panihida', 'Панихида'], ['soborovanie', 'Соборование'], ['venchanie', 'Венчание'], ['ispoved', 'Исповедь'], ['akafist', 'Акафист'], ['izobrazitelny', 'Изобразительны'], ['vespers-small', 'Малая вечерня'], ['vespers', 'Вечерня'], ['matins', 'Утреня'], ['vsenoshchnoe', 'Всенощное бдение'], ['hour-1', '1-й час'], ['hour-3', '3-й час'], ['hour-6', '6-й час'], ['hour-9', '9-й час'], ['midnight', 'Полунощница'], ['compline', 'Малое повечерие'], ['compline-great', 'Великое повечерие'], ['liturgy-chrysostom', 'Литургия Иоанна Златоустаго'], ['liturgy-basil', 'Литургия Василия Великого (!)'], ['liturgy-presanctified', 'Литургия Преждеосвященных Даров (!)']] as const;
export interface DayConfig {
    date: string;
    memories: string[];
    sign: string | null;
    morningService?:"liturgy"|"typica"|null;
    morningLiturgies?:import("./practice").LiturgyCount|null;
}
export function serviceLabel(key: string, sign: string) {
    if (key === 'vespers')
        return ['polieley', 'bdenie', 'velikoe-bdenie'].includes(sign) ? 'Великая вечерня' : 'Вседневная вечерня';
    if (key === 'matins')
        return sign === 'polieley' ? 'Утреня с полиелеем' : sign === 'slavoslovie' ? 'Утреня со славословием' : 'Вседневная утреня';
    return SERVICE_CHOICES.find(s => s[0] === key)?.[1] ?? key;
}
export function validateDayConfig(value: unknown): DayConfig {
    const v = value as DayConfig;
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v.date) || !Array.isArray(v.memories) || v.memories.length > 20 || v.memories.some(x => typeof x !== 'string' || !x || x.length > 200) || new Set(v.memories).size !== v.memories.length)
        throw Error('Проверьте дату и список святых');
    if (v.sign !== null && !SERVICE_SIGNS.some(s => s[0] === v.sign))
        throw Error('Неизвестный знак службы');
    if(v.morningLiturgies!=null&&![1,2,3].includes(v.morningLiturgies))throw Error("Количество литургий — от одной до трёх");
    if(v.morningService!=null&&!["liturgy","typica"].includes(v.morningService))throw Error("Выберите утреннее богослужение");
    return { ...(v.morningService?{morningService:v.morningService}:{}), date: v.date, memories: v.memories, sign: v.sign, ...(v.morningLiturgies!=null?{morningLiturgies:v.morningLiturgies}:{}) };
}
export function dayOrdoHref(day: ParishDay, ustav?: string | null) {
    const q = new URLSearchParams({ date: day.date });
    if (ustav)
        q.set('ustav', ustav);
    for (const id of day.serviceMemories ?? [])
        q.append('memories', id);
    if (day.serviceSign)
        q.set('service_sign', day.serviceSign);
    if (day.serviceVariant)
        q.set('variant', day.serviceVariant);
    for (const p of day.servicePrestoly ?? [])
        q.append('prestoly', [p.memoryId, p.kind ?? '', p.label ?? ''].join('|'));
    return '/posledovanie?' + q;
}
export function composedServices(keys: string[], sign: string) {
    const selected = [...new Set(keys)];
    return selected.filter(key => !selected.includes('vsenoshchnoe') || !['vespers', 'vespers-small', 'matins'].includes(key)).map(key => ({ key, label: serviceLabel(key, sign), own: true }));
}
export function serviceSelection(keys: string[], key: string, checked: boolean) {
    let next = keys.filter(k => k !== key);
    if (!checked)
        return next;
    if (key === 'vsenoshchnoe')
        next = next.filter(k => !['vespers', 'vespers-small', 'matins'].includes(k));
    if (['vespers', 'vespers-small', 'matins'].includes(key))
        next = next.filter(k => k !== 'vsenoshchnoe');
    if(['compline','compline-great'].includes(key))next=next.filter(k=>!['compline','compline-great'].includes(k));
    if (key.startsWith('liturgy-'))
        next = next.filter(k => !k.startsWith('liturgy-'));
    return [...next, key];
}
