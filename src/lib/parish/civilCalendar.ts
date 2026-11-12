/** Годовой производственный календарь isDayOff: переносы рабочих дней
 * учитываются в ответе API, сокращённый день остаётся рабочим. */
export function parseCivilYear(year: number, body: string): Record<string, boolean> {
    const length = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
    if (body.length !== length || !/^[0124]+$/.test(body))
        throw Error('Неполный производственный календарь');
    return Object.fromEntries([...body].map((status, i) => [new Date(Date.UTC(year, 0, 1 + i)).toISOString().slice(0, 10), status === '1']));
}
/** Формат официального репозитория isdayoff/calendars: базовая пятидневка,
 * dayoff добавляет праздники, workday отменяет выходные при переносе. */
export function parseCivilSource(country:string,year:number,value:unknown):Record<string,boolean>{
    const source=value as {year:number;countrycode:string;dayoff:string[];workday:string[];covidday?:string[];predayoff?:string[]};
    if(!source||source.year!==year||source.countrycode!==country.toLowerCase()||!Array.isArray(source.dayoff)||!Array.isArray(source.workday))throw Error('Неверный резервный календарь');
    const size=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
    const result=Object.fromEntries(Array.from({length:size},(_,i)=>{const date=new Date(Date.UTC(year,0,i+1));return [date.toISOString().slice(0,10),[0,6].includes(date.getUTCDay())];}));
    const apply=(dates:string[],off:boolean)=>{for(const raw of dates){
        if(typeof raw!=='string'||!/^\d{4}$/.test(raw))throw Error('Неверная дата календаря');
        const date=year+'-'+raw.slice(0,2)+'-'+raw.slice(2);
        if(!(date in result))throw Error('Дата вне года');result[date]=off;
    }};
    apply(source.dayoff,true);apply(source.covidday??[],true);apply(source.workday,false);apply(source.predayoff??[],false);
    return result;
}
async function fetchCivilData(country:string,year:number){
    try{
        const url=new URL(process.env.CIVIL_CALENDAR_URL||'https://isdayoff.ru/api/getdata');
        url.searchParams.set('year',String(year));url.searchParams.set('cc',country.toLowerCase());url.searchParams.set('pre','1');
        const response=await fetch(url,{signal:AbortSignal.timeout(8000),cache:'no-store'});
        if(!response.ok)throw Error('calendar unavailable');
        return parseCivilYear(year,(await response.text()).trim());
    }catch{
        const response=await fetch(`https://raw.githubusercontent.com/isdayoff/calendars/main/db/${year}/${country.toLowerCase()}${year}.json`,{signal:AbortSignal.timeout(5000),cache:'no-store'});
        if(!response.ok)throw Error('calendar unavailable');
        return parseCivilSource(country,year,await response.json());
    }
}
const failedUntil = new Map<string, number>();
const years = new Map<string, {
    at: number;
    data: Record<string, boolean>;
}>(), pending = new Map<string, Promise<Record<string, boolean> | null>>();
export async function civilYear(country: string, year: number): Promise<Record<string, boolean> | null> {
    if (!/^[A-Z]{2}$/.test(country))
        return null;
    const key = country + year, cached = years.get(key);
    if (cached && Date.now() - cached.at < 86400000)
        return cached.data;
    if ((failedUntil.get(key) ?? 0) > Date.now())
        return cached?.data ?? null;
    if (pending.has(key))
        return pending.get(key)!;
    const task = (async () => {
        try {
            const data=await fetchCivilData(country,year);
            years.set(key, { at: Date.now(), data });
            failedUntil.delete(key);
            if (years.size > 24)
                years.delete(years.keys().next().value!);
            return data;
        }
        catch {
            failedUntil.set(key, Date.now() + 300000);
            if (failedUntil.size > 24)
                failedUntil.delete(failedUntil.keys().next().value!);
            return cached?.data ?? null;
        }
    })();
    pending.set(key, task);
    try {
        return await task;
    }
    finally {
        pending.delete(key);
    }
}
