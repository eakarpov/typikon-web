import { knownTimeZone } from '@/lib/push/zones';
export interface PlanReminder {
    enabled: boolean;
    time: string;
    weekdays: number[];
    timeZone: string;
    version?: string;
}
export function parsePlanReminder(raw: unknown): PlanReminder | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.enabled !== 'boolean' || typeof r.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)
        || typeof r.timeZone !== 'string' || r.timeZone.length > 100 || !knownTimeZone(r.timeZone) || !Array.isArray(r.weekdays) || r.weekdays.length > 7
        || r.weekdays.some(d => !Number.isInteger(d) || d < 1 || d > 7) || r.enabled && !r.weekdays.length)
        return null;
    return { enabled: r.enabled, time: r.time, timeZone: r.timeZone, weekdays: [...new Set(r.weekdays as number[])].sort((a, b) => a - b) };
}
/** One local calendar day, including a repeated DST hour. No backlog outside the one-hour grace window. */
export function duePlanReminder(plan: {
    status: string;
    reminder?: PlanReminder;
}, now: Date): string | null {
    const r = plan.reminder;
    if (plan.status !== 'active' || !r?.enabled || !parsePlanReminder(r))
        return null;
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: r.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
    const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1;
    const minute = Number(p.hour) * 60 + Number(p.minute), [h, m] = r.time.split(':').map(Number), delta = minute - h * 60 - m;
    return r.weekdays.includes(weekday) && delta >= 0 && delta < 60 ? `${p.year}-${p.month}-${p.day}` : null;
}
