import { serviceSelection } from './dayConfig';
import type { Gathering, GatheringService, Part } from './types';
export interface ServiceMemory {
    memoryId: string;
    label: string;
}
export interface ServiceDetails {
    moleben?: {
        memories: ServiceMemory[];
        akathist: boolean;
    };
    compline?: {
        memories: ServiceMemory[];
    };
}
export interface ServiceDetailsInput {
    moleben?: {
        memoryIds: string[];
        akathist: boolean;
    };
    compline?: {
        memoryIds: string[];
    };
}
export function detailsInput(details?: ServiceDetails): ServiceDetailsInput {
    return { ...(details?.moleben ? { moleben: { memoryIds: details.moleben.memories.map(m => m.memoryId), akathist: details.moleben.akathist } } : {}), ...(details?.compline ? { compline: { memoryIds: details.compline.memories.map(m => m.memoryId) } } : {}) };
}
export function validateServiceDetails(keys: string[], value: unknown): ServiceDetailsInput {
    const v = (value ?? {}) as ServiceDetailsInput, result: ServiceDetailsInput = {};
    for (const [key, max, present] of [['moleben', 4, keys.includes('moleben')], ['compline', 2, keys.some(k => k === 'compline' || k === 'compline-great')]] as const) {
        if (!present || !v[key])
            continue;
        const item = v[key]!;
        if (!Array.isArray(item.memoryIds) || item.memoryIds.length > max || new Set(item.memoryIds).size !== item.memoryIds.length || item.memoryIds.some(id => typeof id !== 'string' || !id || id.length > 200))
            throw Error(`Для ${key === 'moleben' ? 'молебна' : 'повечерия'} выберите не более ${max} памятей`);
        if (key === 'moleben') {
            const akathist = v.moleben!.akathist;
            if (typeof akathist !== 'boolean')
                throw Error('Проверьте выбор акафиста');
            result.moleben = { memoryIds: item.memoryIds, akathist };
        }
        else
            result.compline = { memoryIds: item.memoryIds };
    }
    return result;
}
export async function resolveServiceDetails(input: ServiceDetailsInput, lookup: (id: string) => Promise<{
    label: string;
} | null>): Promise<ServiceDetails> {
    const result: ServiceDetails = {};
    const memories = async (ids: string[]) => Promise.all(ids.map(async (memoryId) => { const found = await lookup(memoryId); if (!found)
        throw Error('Выбранная память не найдена'); return { memoryId, label: found.label }; }));
    if (input.moleben)
        result.moleben = { memories: await memories(input.moleben.memoryIds), akathist: input.moleben.akathist };
    if (input.compline)
        result.compline = { memories: await memories(input.compline.memoryIds) };
    return result;
}
export function detailServices(services: GatheringService[], details?: ServiceDetails): GatheringService[] {
    return services.filter(s => !(s.key === 'akafist' && services.some(k => k.key === 'moleben') && details?.moleben?.akathist)).map(s => {
        const info = s.key === 'moleben' ? details?.moleben : ['compline', 'compline-great'].includes(s.key) ? details?.compline : undefined;
        if (!info)
            return s;
        const label = s.key === 'moleben' ? 'Молебен' + (details?.moleben?.akathist ? ' с акафистом' : '') : s.label;
        return { ...s, label: label + (info.memories.length ? ' — ' + info.memories.map(m => m.label).join('; ') : '') };
    });
}
export function hasDayService(services: GatheringService[]) { return services.some(s => ['vespers', 'vespers-small', 'matins', 'vsenoshchnoe', 'liturgy'].includes(s.key) || s.key.startsWith('liturgy-')); }
export function nextDayLabel(g: Gathering) { return !g.cancelled && hasDayService(g.services) ? g.belongsTo : null; }
const hour = (key: string): GatheringService => ({ key, label: ({ 'hour-3': '3-й час', 'hour-6': '6-й час', 'hour-9': '9-й час' } as Record<string, string>)[key] });
const liturgy = (s: GatheringService) => s.key === 'liturgy' || s.key.startsWith('liturgy-') || s.label.startsWith('Литургия');
export function defaultHourServices(services: GatheringService[], part: Part): GatheringService[] {
    let result = services.slice();
    const insert = (keys: string[], at: (s: GatheringService) => boolean) => {
        const index = result.findIndex(at);
        if (index < 0)
            return;
        const required = keys.map(key => result.find(s => s.key === key) ?? hour(key));
        const target = result[index];
        result = result.filter(s => !keys.includes(s.key));
        result.splice(result.indexOf(target), 0, ...required);
    };
    if (part === 'utro' || part === 'den')
        insert(['hour-3', 'hour-6'], s => liturgy(s) || s.key === 'izobrazitelny');
    if (part === 'vecher')
        insert(['hour-9'], s => ['vespers', 'matins', 'vsenoshchnoe'].includes(s.key) || liturgy(s));
    return result;
}
export function defaultHours(g: Gathering): Gathering {
    const relevant = g.part === 'vecher' ? hasDayService(g.services) : (g.part === 'utro' || g.part === 'den') && g.services.some(s => liturgy(s) || s.key === 'izobrazitelny');
    if (!relevant)
        return g;
    const services = defaultHourServices(g.services, g.part);
    const defaults = g.part === 'vecher' ? ['hour-9'] : ['hour-3', 'hour-6'];
    const visible = services.filter(s => defaults.includes(s.key) && !g.title.includes(s.label));
    return { ...g, services, title: visible.length ? visible.map(s => s.label).join('. ') + '. ' + g.title : g.title };
}
/** Автоподстановка при выборе службы не мешает отдельно убрать/добавить часы. */
export function chooseService(keys: string[], key: string, checked: boolean, part: Part): string[] {
    const next = serviceSelection(keys, key, checked);
    const core = ['vespers', 'matins', 'vsenoshchnoe', 'izobrazitelny'].includes(key) || key.startsWith('liturgy-');
    if (checked && core)
        return defaultHourServices(next.map(key => ({ key, label: key })), part).map(s => s.key);
    if (!checked && core) {
        if (part === 'vecher' && !hasDayService(next.map(key => ({ key, label: key }))))
            return next.filter(k => k !== 'hour-9');
        if ((part === 'utro' || part === 'den') && !next.some(k => k.startsWith('liturgy-') || k === 'liturgy' || k === 'izobrazitelny'))
            return next.filter(k => !['hour-3', 'hour-6'].includes(k));
    }
    return next;
}
