import { validDate, nextDate } from '@/lib/readingPlan/core';
export function offlineDays(from: unknown, to: unknown): string[] | null {
    if (!validDate(from) || !validDate(to) || from > to)
        return null;
    const days: string[] = [];
    for (let d = from; d <= to; d = nextDate(d)) {
        days.push(d);
        if (days.length > 31)
            return null;
    }
    return days;
}
export interface OfflineDay {
    date: string;
    title: string;
    available: boolean;
}
