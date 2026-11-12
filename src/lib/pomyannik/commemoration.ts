import type { PomyannikPerson, PersonKind } from './types';
export const COMMEMORATION_PLACES = ['psalter-1','psalter-2','psalter-3','morning-living','morning-departed'] as const;
export type CommemorationPlace = typeof COMMEMORATION_PLACES[number];
export interface CommemorationSelection { mode: 'none' | 'living' | 'departed' | 'group'; group?: string; for?: PersonKind | 'both' }
export type CommemorationSettings = Record<CommemorationPlace, CommemorationSelection>;
export const COMMEMORATION_LABELS: Record<CommemorationPlace,string> = {
    'psalter-1':'Псалтирь — после первой славы', 'psalter-2':'Псалтирь — после второй славы', 'psalter-3':'Псалтирь — после третьей славы',
    'morning-living':'Утренние молитвы — о здравии', 'morning-departed':'Утренние молитвы — о упокоении',
};
export const defaultCommemorations = (): CommemorationSettings => ({
    'psalter-1':{mode:'living'}, 'psalter-2':{mode:'departed'}, 'psalter-3':{mode:'none'},
    'morning-living':{mode:'living'}, 'morning-departed':{mode:'departed'},
});
export const isCommemorationPlace = (raw: unknown): raw is CommemorationPlace => typeof raw === 'string' && (COMMEMORATION_PLACES as readonly string[]).includes(raw);
export class CommemorationError extends Error {}
export const validateCommemorations = (raw: unknown): Partial<CommemorationSettings> => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Object.keys(raw).length) throw new CommemorationError('Не указаны настройки поминовения.');
    const result: Partial<CommemorationSettings> = {};
    for (const [place, entry] of Object.entries(raw)) {
        if (!isCommemorationPlace(place) || !entry || typeof entry !== 'object' || Array.isArray(entry)) throw new CommemorationError('Неизвестное место поминовения.');
        const value = entry as CommemorationSelection;
        if (!['none','living','departed','group'].includes(value.mode)) throw new CommemorationError('Выберите имена для поминовения.');
        if ((place === 'morning-living' && value.mode === 'departed') || (place === 'morning-departed' && value.mode === 'living')) throw new CommemorationError('Раздел помянника должен соответствовать молитве.');
        if (value.mode === 'group') {
            if (typeof value.group !== 'string' || !value.group.trim() || value.group.length > 40 || /[\u0000-\u001f]/.test(value.group)) throw new CommemorationError('Выберите группу помянника.');
            if(value.for!==undefined&&!['living','departed','both'].includes(value.for)) throw new CommemorationError('Выберите раздел группы.');
            if((place==='morning-living'&&value.for==='departed')||(place==='morning-departed'&&value.for==='living')) throw new CommemorationError('Раздел группы должен соответствовать молитве.');
            result[place] = { mode:'group', group:value.group, ...(value.for?{for:value.for}:{}) };
        } else result[place] = { mode:value.mode };
    }
    return result;
};
export const readCommemorations = (raw: unknown): CommemorationSettings => {
    const defaults = defaultCommemorations();
    if (raw && typeof raw === 'object') for (const place of COMMEMORATION_PLACES) {
        try { Object.assign(defaults, validateCommemorations({[place]:(raw as Record<string,unknown>)[place]})); } catch { /* Старая запись без поля использует своё значение по умолчанию. */ }
    }
    return defaults;
};
export const selectCommemorationPersons = (persons: PomyannikPerson[], place: CommemorationPlace, choice: CommemorationSelection): PomyannikPerson[] => {
    if (choice.mode === 'none') return [];
    const fixedKind: PersonKind | null = place === 'morning-living' ? 'living' : place === 'morning-departed' ? 'departed' : choice.mode==='group'&&choice.for&&choice.for!=='both'?choice.for:null;
    return persons.filter(person => !person.deletedAt && (!fixedKind || person.kind === fixedKind)
        && (choice.mode === 'group' ? person.groups.includes(choice.group ?? '') : person.kind === choice.mode));
};
export const commemorationGroups = (persons: PomyannikPerson[]) => {
    const groups = new Map<string,{name:string;living:number;departed:number}>();
    for (const person of persons) if (!person.deletedAt) for (const name of new Set(person.groups)) {
        const value = groups.get(name) ?? { name, living:0, departed:0 }; value[person.kind]++; groups.set(name,value);
    }
    return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'ru'));
};
