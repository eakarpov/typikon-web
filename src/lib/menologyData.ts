import { cached, CacheTag } from "@/lib/cache";
import { getLinkedSaint, getMemory } from "@/lib/memories";
import { menologyDay, menologyRange, menologyUstavy } from "@/lib/ordo";
import { isPersonSaint } from "@/lib/saintFacts";
import { civilAt, parseCivilDate, type CalendarCard, type CalendarRange } from "./menology";

export const getCalendarUstavy = cached(async () => {
    const { data } = await menologyUstavy();
    if (!data?.length) throw new Error("Список уставов недоступен");
    return data;
}, ["menology-ustavy"], [CacheTag.ORDO]);

export const getCalendarRange = cached(async (ustav: string, from: string, to: string) => {
    const first = parseCivilDate(from)!;
    const last = parseCivilDate(to)!;
    const { data } = await menologyRange(ustav, from, to);
    if (!data || !Array.isArray(data.days) || !Array.isArray(data.failed)) throw new Error("Дни не загрузились");
    const dates = new Set(data.days.map(day => day.date));
    if (data.failed.length || dates.size !== last - first + 1 ||
        dates.size !== data.days.length || [...dates].some(date => date < from || date > to || parseCivilDate(date) == null)) {
        // Частичная выборка остаётся доступна для этого запроса и может быть повторена.
        const failed = [];
        for (let jdn = first; jdn <= last; jdn++) if (!dates.has(civilAt(jdn))) failed.push(civilAt(jdn));
        throw new IncompleteRange({ days: data.days, failed });
    }
    return data;
}, ["menology-range"], [CacheTag.ORDO]);

class IncompleteRange extends Error {
    constructor(readonly result: CalendarRange) { super("Часть дней не загрузилась"); }
}

export async function loadCalendarRange(ustav: string, from: string, to: string) {
    try { return await getCalendarRange(ustav, from, to); }
    catch (error) {
        if (error instanceof IncompleteRange) return error.result;
        return null;
    }
}

const getCalendarDay = cached(async (ustav: string, date: string) => {
    const { data } = await menologyDay(ustav, date);
    if (!data?.calendar || data.calendar.date !== date) throw new Error("День недоступен");
    return data.calendar;
}, ["menology-day"], [CacheTag.ORDO]);

export async function loadCalendarCard(ustav: string, date: string): Promise<CalendarCard | null> {
    const detail = await getCalendarDay(ustav, date).catch(() => null);
    if (!detail) return null;
    const memories = await Promise.all(detail.memories.map(async memory => {
        try {
            const saint = await getLinkedSaint(memory.id);
            const saintId = saint?.slug ?? saint?._id;
            if (saintId && isPersonSaint(saint)) return { ...memory, href: `/saints/${encodeURIComponent(saintId)}` };
            if (await getMemory(memory.id)) return { ...memory, href: `/memories/${encodeURIComponent(memory.id)}` };
        } catch {
            // Не теряем память движка, если портал не смог получить её ссылку.
        }
        return memory;
    }));
    return { ...detail, memories };
}
