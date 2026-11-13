import { psalterCommemorationTexts } from './psalter-names';
import { namedPrayerTexts, NAMED_STYLES, type PrayerLang } from '@/lib/molitvoslov/store';
import { renderNamedPrayer, type NamedPerson, type PrayerGender } from '@/lib/molitvoslov/named';
import { personSlavonicForms } from './slavonic';
import { effectiveRank, effectiveRanks } from './marks';
import { getBookSettings, listPersons } from './service';
import { defaultCommemorations, selectCommemorationPersons, type CommemorationPlace, type CommemorationSettings } from './commemoration';
import type { PomyannikPerson, PersonKind } from './types';
import { rulesDb } from '@/lib/rulesDb';
export interface CommemorationContext { settings:CommemorationSettings; persons:PomyannikPerson[]; signedIn:boolean }
export const loadCommemorationContext = async (userId?:string):Promise<CommemorationContext> => {
    if(!userId) return {settings:defaultCommemorations(),persons:[],signedIn:false};
    const [settings,persons] = await Promise.all([getBookSettings(userId),listPersons(userId)]);
    return {settings:settings.commemorations,persons,signedIn:true};
};
export const selectedNamedPersons = async (context:CommemorationContext,place:CommemorationPlace):Promise<Record<PersonKind,NamedPerson[]>> => {
    const selected=selectCommemorationPersons(context.persons,place,context.settings[place]);
    const forms=await personSlavonicForms(selected);
    const result:Record<PersonKind,NamedPerson[]>={living:[],departed:[]};
    selected.forEach((person, index) => result[person.kind].push({name:forms[index].genitive,dative:forms[index].dative,commemorationSuffix:person.commemorationSuffix,rank:effectiveRank(person),marks:effectiveRanks(person),sex:person.sex}));
    return result;
};
export async function commemorationPrayers(context:CommemorationContext,place:CommemorationPlace,lang:PrayerLang,gender:PrayerGender) {
    const selection=context.settings[place];
    const names=await selectedNamedPersons(context,place);
    const counts={living:names.living.length,departed:names.departed.length};
    const prayers:{id:string;title:string|null;text:string;for:PersonKind;lang:PrayerLang;italic?:string[]}[]=[];
    const missing:string[]=[];
    const notes:string[]=[];
    if(selection.mode==='none') return {selection,counts,prayers,missing,notes};
    if(!context.signedIn) notes.push('Поимённое поминовение из помянника доступно после входа.');
    const kinds:PersonKind[]=selection.mode==='group'?(['living','departed'] as const).filter(kind=>names[kind].length>0):[selection.mode];
    if(selection.mode==='group'&&!kinds.length) notes.push('В выбранной группе нет подходящих имён. Имена из других групп не добавлены.');
    if(place.startsWith('psalter-')) {
        prayers.push(...psalterCommemorationTexts(names, gender, place === 'psalter-3', kinds));
        return {selection,counts,prayers,missing,notes};
    }
    for(const kind of kinds) {
        const style=place.startsWith('psalter-')&&kind==='departed'?'psalter-departed':'molitvoslov-short';
        const found=namedPrayerTexts(NAMED_STYLES[style][kind],lang,gender);
        if(!found?.prayers.length) {missing.push(`Молитва ${kind==='living'?'о здравии':'о упокоении'} недоступна.`);continue;}
        prayers.push(...found.prayers.map(prayer=>({...prayer,for:kind,lang:found.lang,text:renderNamedPrayer(prayer.text,names[kind],gender)})));
    }
    return {selection,counts,prayers,missing,notes};
}
/** Идентифицируем книжные места по ID источника, включая женские варианты. */
export function morningCommemorationIds():Map<string,PersonKind> {
    const db=rulesDb(); if(!db) return new Map();
    const rows=db.prepare("SELECT moment,text_id,text_id_f FROM fixed_text_occurrences WHERE book='molitvoslov' AND moment IN ('utrennie/o-zhivyh','utrennie/ob-usopshih')").all() as {moment:string;text_id:string;text_id_f:string|null}[];
    const result=new Map<string,PersonKind>();
    for(const row of rows) for(const id of [row.text_id,row.text_id_f]) if(id) result.set(id,row.moment==='utrennie/o-zhivyh'?'living':'departed');
    return result;
}
