import {defaultHours} from "./serviceDetails";
import type { Gathering, ParishDay, ParishRule } from './types';
import { serviceLabel } from './dayConfig';
export type Frequency = 'always' | 'lent' | 'never';
export type LiturgyCount = 1 | 2 | 3;
export type Slot = 'early' | 'ordinary' | 'late';
export type TimeKey = 'weekday' | 'weekend' | 'saturday' | 'sundayEarly' | 'sundayOrdinary' | 'sundayLate' | 'feastEarly' | 'feastOrdinary' | 'feastLate' | 'patronEarly' | 'patronOrdinary' | 'patronLate';
export interface TimePair {
    morning: string;
    evening: string;
}
export interface ParishPractice {
    country: string;
    times: Record<TimeKey, TimePair>;
    compline: Frequency;
    midnight: Frequency;
    panihida: 'friday-vespers' | 'friday-end' | 'saturday-liturgy' | 'never';
    liturgies: {
        sunday: LiturgyCount;
        feast: LiturgyCount;
        patron: LiturgyCount;
    };
}
export const TIME_ROWS: [
    TimeKey,
    string
][] = [['weekday', 'Будний день'], ['weekend', 'Выходной день'], ['saturday', 'Суббота'], ['sundayEarly', 'Воскресенье — ранняя'], ['sundayOrdinary', 'Воскресенье — обычная'], ['sundayLate', 'Воскресенье — поздняя'], ['feastEarly', 'Великий праздник — ранняя'], ['feastOrdinary', 'Великий праздник — обычная'], ['feastLate', 'Великий праздник — поздняя'], ['patronEarly', 'Престол — ранняя'], ['patronOrdinary', 'Престол — обычная'], ['patronLate', 'Престол — поздняя']];
export function defaultPractice(country = ''): ParishPractice {
    const times = Object.fromEntries(TIME_ROWS.map(([key]) => [key, { morning: key === 'weekday' ? '09:00' : key === 'weekend' ? '09:30' : key.endsWith('Early') ? '07:00' : key.endsWith('Late') ? '11:00' : '', evening: ['weekday', 'weekend'].includes(key) ? '17:00' : '' }])) as Record<TimeKey, TimePair>;
    return { country: /^[A-Z]{2}$/i.test(country) ? country.toUpperCase() : '', times, compline: 'lent', midnight: 'never', panihida: 'never', liturgies: { sunday: 1, feast: 1, patron: 1 } };
}
export function validatePractice(value: unknown): ParishPractice {
    const v = value as ParishPractice;
    if (!v || typeof v.country !== 'string' || !/^([A-Z]{2})?$/.test(v.country) || !['always', 'lent', 'never'].includes(v.compline) || !['always', 'lent', 'never'].includes(v.midnight) || !['friday-vespers', 'friday-end', 'saturday-liturgy', 'never'].includes(v.panihida))
        throw Error('Проверьте настройки состава и страны');
    for (const [key] of TIME_ROWS)
        for (const part of ['morning', 'evening'] as const)
            if (typeof v.times?.[key]?.[part] !== 'string' || !/^$|^([01]\d|2[0-3]):[0-5]\d$/.test(v.times[key][part]))
                throw Error('Проверьте время богослужений');
    if (!v.times.weekday.morning || !v.times.weekday.evening || !v.times.weekend.morning || !v.times.weekend.evening)
        throw Error('Укажите базовое время буднего и выходного дня');
    for (const key of ['sunday', 'feast', 'patron'] as const)
        if (![1, 2, 3].includes(v.liturgies?.[key]))
            throw Error('Количество литургий — от одной до трёх');
    return { country: v.country, times: Object.fromEntries(TIME_ROWS.map(([key]) => [key, { morning: v.times[key].morning, evening: v.times[key].evening }])) as Record<TimeKey, TimePair>, compline: v.compline, midnight: v.midnight, panihida: v.panihida, liturgies: { sunday: v.liturgies.sunday, feast: v.liturgies.feast, patron: v.liturgies.patron } };
}
export const PRACTICE_RULES: ParishRule[] = [
    { key: 'practice-drop', label: 'Отдельные службы по составу прихода', when: {}, then: { drop: ['compline', 'compline-great', 'midnight', 'vespers-small'] } },
    { key: 'practice-matins', label: 'Утреня накануне', when: { part: 'utro', hasService: ['matins'] }, then: { move: [{ services: ['matins', 'hour-1'], to: 'vecher', dayOffset: -1 }] } },
    { key: 'practice-lent-matins', label: 'Постовая утреня утром', when: { part: 'utro', triod: ['velikiy-post'] }, then: { move: [{ services: ['matins', 'hour-1'], to: 'utro', dayOffset: 0 }] } },
    { key: 'practice-vigil', label: 'Всенощное бдение', when: { hasService: ['vsenoshchnoe'] }, then: { choose: ['vsenoshchnoe'] } },
];
export function slots(count: LiturgyCount): Slot[] { return count === 1 ? ['ordinary'] : count === 2 ? ['early', 'ordinary'] : ['early', 'ordinary', 'late']; }
/** Ключ ordinary сохраняет уже заданное время второй литургии. */
export function liturgySlotLabel(slot:Slot,count:LiturgyCount){return slot==='early'?'Ранняя':slot==='late'?'Поздняя':count===2?'Поздняя':count===3?'Средняя':'Обычная';}
export function timeRowLabel(key:TimeKey,label:string,p:ParishPractice){
 for(const category of ['sunday','feast','patron'] as const)if(key===category+'Ordinary')return label.replace('обычная',liturgySlotLabel('ordinary',p.liturgies[category]).toLowerCase());
 return label;
}
export function category(day: ParishDay): 'sunday' | 'feast' | 'patron' | null { return day.prestolny ? 'patron' : day.dvunadesyaty || day.sign === 'velikoe-bdenie' ? 'feast' : new Date(day.date + 'T12:00:00Z').getUTCDay() === 0 ? 'sunday' : null; }
export function countForDay(day: ParishDay, p: ParishPractice): LiturgyCount { return day.dayConfig?.morningLiturgies ?? (category(day) ? p.liturgies[category(day)!] : 1); }
export function practiceTime(day: ParishDay, p: ParishPractice, part: 'morning' | 'evening', slot: Slot = 'ordinary') {
    const weekday = new Date(day.date + 'T12:00:00Z').getUTCDay(), cat = category(day), base = weekday === 0 || day.civilDayOff === true || weekday === 6 && day.civilDayOff !== false ? 'weekend' : 'weekday';
    let key: TimeKey = base;
    if (cat)
        key = (cat + slot[0].toUpperCase() + slot.slice(1)) as TimeKey;
    else if (weekday === 6)
        key = 'saturday';
    // Воскресные указания имеют приоритет над гражданским календарём.
    return p.times[key][part] || p.times[base][part];
}
export function isLiturgy(g: Gathering) { return g.services.some(s => s.key === 'liturgy' || s.key.startsWith('liturgy-')) || g.title.includes('Литургия'); }
export function applyPractice(days: ParishDay[], p: ParishPractice): ParishDay[] {
    return days.map(day => {
        let gatherings = day.gatherings.map(g => ({ ...g,
            // Движок включает скрытый в названии 9-й час в обычное утро.
            // В приходском варианте перед Литургией — 3-й и 6-й; постовой
            // порядок сохраняем. Явные правки состава применяются позже.
            services: g.services.filter(s => !(s.key === 'hour-9' && g.part === 'utro' && isLiturgy(g) && day.liturgicalSeason !== 'velikiy-post')),
            time: practiceTime(day, p, g.part === 'vecher' ? 'evening' : 'morning', g.liturgySlot) }));
        const candidates = gatherings.filter(g => g.part === 'utro' && isLiturgy(g));
        const template = candidates[0];
        const typica=day.dayConfig?.morningService==='typica';
        if(typica){
            const existing=gatherings.find(g=>g.part==='utro'&&g.services.some(s=>s.key==='izobrazitelny'));
            const source=existing??template??gatherings.find(g=>g.part==='utro');
            gatherings=gatherings.filter(g=>!candidates.includes(g)&&g!==source&&g!==existing);
            const services=source?.services.filter(s=>s.key!=='liturgy'&&!s.key.startsWith('liturgy-')&&!s.label.startsWith('Литургия'))??[];
            if(!services.some(s=>s.key==='izobrazitelny'))services.push({key:'izobrazitelny',label:'Изобразительны',own:true});
            gatherings.push({key:existing?.key??day.date+':utro:typica',civil:day.date,part:'utro',partLabel:'утром',time:practiceTime(day,p,'morning'),title:services.map(s=>s.label).join('. '),belongsTo:null,duration:source?.duration??null,services,why:[{kind:'parish',text:'Изобразительны выбраны вместо Литургии'}]});
        }
        else if (template || day.dayConfig?.morningLiturgies || day.dayConfig?.morningService==='liturgy') {
            const source = template ?? { key: day.date + ':utro:liturgy', civil: day.date, part: 'utro' as const, partLabel: 'утром', time: null, title: serviceLabel('liturgy-chrysostom', day.sign), belongsTo: null, duration: null, services: [{ key: 'liturgy-chrysostom', label: serviceLabel('liturgy-chrysostom', day.sign), own: true }], why: [] };
            const count = countForDay(day, p);
            gatherings = gatherings.filter(g => !candidates.includes(g));
            for (const slot of slots(count))
                gatherings.push({ ...source, key: slot === 'ordinary' ? source.key : source.key + ':' + slot, liturgySlot: slot, title: (count > 1 ? liturgySlotLabel(slot,count)+' ' : '') + source.title, time: practiceTime(day, p, 'morning', slot), services: source.services.slice() });
        }
        const extra = (key: string, part: 'utro' | 'vecher', label = serviceLabel(key, day.sign)) => ({ key: day.date + ':practice:' + key, civil: day.date, part, partLabel: part === 'utro' ? 'утром' : 'вечером', time: practiceTime(day, p, part === 'utro' ? 'morning' : 'evening'), title: label, belongsTo: null, duration: null, services: [{ key, label, own: true }], why: [{ kind: 'parish' as const, text: 'Постоянный состав прихода' }] });
        const lent = day.liturgicalSeason === 'velikiy-post';
        for (const [mode, key, part] of [[p.compline, lent ? 'compline-great' : 'compline', 'vecher'], [p.midnight, 'midnight', 'utro']] as const)
            if (mode === 'always' || mode === 'lent' && lent)
                gatherings.push(extra(key, part));
        const weekday = new Date(day.date + 'T12:00:00Z').getUTCDay();
        const panihida = (target: Gathering | undefined, afterVespers = false) => {
            const label = afterVespers ? 'Панихида после вечерни' : 'Панихида';
            if (!target)
                return;
            const index = afterVespers ? target.services.findIndex(s => s.key === 'vespers') + 1 : target.services.length;
            target.services.splice(index || target.services.length, 0, { key: 'panihida', label, own: true });
            target.title = target.services.map(s => s.label).join('. ');
        };
        if (weekday === 5 && p.panihida.startsWith('friday')) {
            const evening = gatherings.filter(g => g.part === 'vecher');
            panihida(p.panihida === 'friday-vespers' ? evening.find(g => g.services.some(s => ['vespers', 'vsenoshchnoe'].includes(s.key))) : evening.at(-1), p.panihida === 'friday-vespers');
        }
        if (weekday === 6 && p.panihida === 'saturday-liturgy')
            panihida(gatherings.filter(g => isLiturgy(g)).at(-1));
        gatherings.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
        return { ...day, gatherings:gatherings.map(defaultHours), defaultMorningLiturgies: category(day) ? p.liturgies[category(day)!] : 1 };
    });
}
