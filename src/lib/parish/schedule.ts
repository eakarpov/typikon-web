import {applyPractice} from "./practice";
import {civilYear} from "./civilCalendar";
import {dayConfigs,memoryMetadata} from "./dayConfigStore";
import {ordoDay} from "@/lib/ordo";
import {schedulePeriod,presentationDays,type SchedulePeriodType} from "./period";
import {cacheComplete} from "@/lib/completeCache";
import { cached, CacheTag } from "@/lib/cache";
import { getTemple } from "@/lib/temples";
import { settingsFor } from "./settings";
import { ordoRange } from "@/lib/ordo";
import { buildMonth } from "./gatherings";
import { DEFAULT_RULES } from "./presets";
import { applyEdits, editsOf } from "./edits";
import { driftedDays, publishedMonth } from "./publish";
import type { ParishDay, ParishSettings } from "./types";

/**
 * Приход — это ХРАМ, который у нас уже есть.
 *
 * Заводить рядом свою запись прихода пока незачем: имя, место и престолы
 * лежат в `temples`, престолы там сматчены с памятями (`memoryIds`), а устав
 * помечен полем `ustav`. Не хватает одного — часов, и они пока берутся
 * умолчанием. Своя коллекция понадобится, когда часы начнут править руками.
 */
// Приход целиком собирается в parish/settings: имя и престолы у храма, пояс и
// правила — у самого прихода, если он их назвал.

export interface ParishMonth {
    slug: string;
    title: string;
    ustav?:string|null;
    month: string;
    monthLabel: string;
    civilCalendarAvailable?:boolean;
    periodType:SchedulePeriodType;
    preferredPeriod:SchedulePeriodType;
    /** Пояс, которым живёт подписной календарь. */
    timezone: string;
    /** Откуда он взят: сказан приходом или выведен нами. */
    timezoneHow: "parish" | "country" | "longitude" | null;
    /** Приход пишет свои правила, а не едет на умолчаниях. */
    ownRules: boolean;
    days: ParishDay[];
    /** Служба устава не поднята — расписание строить не из чего. */
    unavailable: boolean;
    /** Все запрошенные даты, включая вечерню последнего дня, получены. */
    complete: boolean;
    /** Даты, на которые устав не ответил: их в расписании нет, и это сказано. */
    failed: string[];
}

const build = async (slug: string, month: string): Promise<ParishMonth | null> => {
    const temple = await getTemple(slug);
    if (!temple) return null;

    const period=schedulePeriod(month);if(!period)return null;

    const settings = await settingsFor(temple);
    const lookAhead=new Date(period.end+"T12:00:00Z");lookAhead.setUTCDate(lookAhead.getUTCDate()+1);
    const dates=[...period.dates,lookAhead.toISOString().slice(0,10)];
    const { days, failed } = await ordoRange(dates, {
        ustav: settings.ustav,
        prestoly: settings.prestoly.map(p => ({
            memoryId: p.memoryId, kind: p.kind, label: p.label,
        })),
    });

    const configs=await dayConfigs(slug,period.start,dates[dates.length-1]);
    const metadata=await memoryMetadata([...days.values()].flatMap(d=>d.memories.map(m=>m.memoryId)).concat(configs.flatMap(c=>c.memories)));
    for(const config of configs){
        if(!config.memories.length&&!config.sign)continue;
        const original=days.get(config.date);if(!original)continue;
        const ids=config.memories.length?config.memories:original.memories.map(m=>m.memoryId);
        const first=config.memories[0]?metadata.get(config.memories[0]):null;
        const sign=config.sign??(config.memories.length?first?.sign?.default??'bez-znaka':original.variants[0]?.sign);
        const chosen=await ordoDay(config.date,{ustav:settings.ustav??undefined,memories:ids,serviceSign:sign,
            prestoly:settings.prestoly});
        if(!chosen){days.delete(config.date);failed.push(config.date);continue;}
        days.set(config.date,chosen);
    }
    const country=settings.practice?.country??temple.country??'';
    const calendars=await Promise.all([...new Set(period.dates.map(date=>Number(date.slice(0,4))))].map(year=>civilYear(country,year)));
    const civilDays=Object.assign({},...calendars.filter(Boolean)) as Record<string,boolean>;
    const civilCalendarAvailable=!!country&&calendars.every(Boolean);
    const built=buildMonth(days,settings,date=>date>=period.start&&date<=period.end);
    await Promise.all(built.map(async row=>{
        const day=days.get(row.date)!;const config=configs.find(c=>c.date===row.date);
        const choices=[...day.memories];
        for(const id of config?.memories??[])if(!choices.some(m=>m.memoryId===id)){const m=metadata.get(id);if(m)choices.push({memoryId:id,label:m.label,book:m.book});}
        row.memoryChoices=await Promise.all(choices.map(async m=>({...m,sign:metadata.get(m.memoryId)?.sign?.default??null})));
        row.civilDayOff=civilDays[row.date];row.liturgicalSeason=day.triod;
        row.dayConfig=config?{date:config.date,memories:config.memories,sign:config.sign,morningLiturgies:config.morningLiturgies,morningService:config.morningService}:undefined;
        const declared=!!config&&(!!config.memories.length||!!config.sign);
        row.serviceMemories=declared?(config.memories.length?config.memories:day.memories.map(m=>m.memoryId)):undefined;
        row.serviceSign=declared?day.variants[0]?.sign:undefined;
        const tomorrow=new Date(row.date+'T12:00:00Z');tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
        row.eveningSign=days.get(tomorrow.toISOString().slice(0,10))?.variants[0]?.sign;
        row.serviceVariant=day.variants[0]?.key;row.servicePrestoly=settings.prestoly;
    }));
    const inPeriod=(date:string)=>date>=period.start&&date<=period.end;
    return {
        slug, title: temple.name, ustav:settings.ustav, month, timezone: settings.timezone,
        timezoneHow: settings.timezoneHow, ownRules: settings.ownRules,
        monthLabel:period.label,periodType:period.type,preferredPeriod:settings.schedulePeriod??"month",
        days: settings.practice?applyPractice(built,settings.practice):built,
        civilCalendarAvailable,
        unavailable: days.size === 0,
        complete: failed.length === 0,
        failed: failed.filter(inPeriod),
    };
};

// ПРОЕКТ кэшируется: он выводится из устава и приходских правил, и меняется
// только вместе с ними.
export const parishMonth = cacheComplete(
    build,
    work=>cached(work,["parish-period-complete"],[CacheTag.PARISH],3600),
    result=>!result||(!result.unavailable&&result.complete),
);

/**
 * Расписание, каким его видят: проект устава плюс правки ответственного.
 *
 * Правки читаются МИМО кэша — их правят по одной, и держать их час значило бы
 * показывать ответственному не то, что он только что исправил.
 */
export const parishSchedule = async (slug: string, month: string) => {
    const data = await parishMonth(slug, month);
    if (!data) return null;
    const edits = await editsOf(slug, schedulePeriod(month)!);
    const { days, applied } = applyEdits(data.days, edits);
    return { ...data, days, edits: applied };
};

export interface ParishView extends ParishMonth {
    edits: Awaited<ReturnType<typeof parishSchedule>> extends null ? never
        : NonNullable<Awaited<ReturnType<typeof parishSchedule>>>["edits"];
    /** Ответственный сказал «готово» — и вот когда. */
    published: Date | null;
    /** Числа, в которых снимок разошёлся с нынешним выводом устава. */
    drifted: string[];
}

/**
 * ЧТО ПОКАЗАТЬ ЧЕЛОВЕКУ.
 *
 * Опубликованное показывается СНИМКОМ, а не свежим выводом: ответственный повесил
 * на стенд определённый лист, и наша правка правил не вправе молча передвинуть
 * ему час — прихожанин придёт не тогда. Лист висит, пока его не заменят.
 *
 * Расхождение при этом считается и отдаётся: видеть его должен ответственный, а
 * решать — он же. Молча пересобрать за него нельзя, молча смолчать тоже.
 */
export const parishView = async (slug: string, month: string, draft=false): Promise<ParishView | null> => {
    const live = await parishSchedule(slug, month);
    if (!live) return null;
    const snapshot = await publishedMonth(slug, month);
    if (!snapshot?.days?.length) {
        return { ...live, published: null, drifted: [] } as ParishView;
    }
    return {
        ...live,
        days: presentationDays(live.days,snapshot.days,draft),
        unavailable: draft ? live.unavailable : false,
        published: snapshot.publishedAt ?? null,
        drifted: driftedDays(snapshot.days, live.days),
    } as ParishView;
};
