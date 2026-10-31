import type {PlanReminder} from './reminders';
export class PlanError extends Error {
}
export interface PlanUnit {
    key: string;
    title: string;
    href: string;
    textId?: string;
    statia?: number;
    slot?: string;
    pericope?: any;
}
export interface ReadingPlan {
    id: string;
    revision: number;
    kind: 'book' | 'lectionary';
    title: string;
    status: 'active' | 'paused' | 'completed';
    cursor: number;
    date: string;
    units: PlanUnit[];
    reminder?: PlanReminder;
}
export const validDate = (date: unknown): date is string => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && !Number.isNaN(Date.parse(date + 'T00:00:00Z')) && new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date
    && date >= '1900-01-01' && date <= '2099-12-31';
export const nextDate = (date: string) => new Date(Date.parse(date + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
/** No clock-based advance: a missed day never creates a debt or skips a reading. */
export function advancePlan(plan: ReadingPlan, length: number): ReadingPlan {
    if (plan.status !== 'active')
        throw new PlanError('Сначала возобновите план.');
    if (plan.kind === 'book') {
        const cursor = Math.min(plan.cursor + 1, length);
        return { ...plan, revision: plan.revision + 1, cursor, status: cursor >= length ? 'completed' : 'active' };
    }
    if (plan.cursor + 1 < length)
        return { ...plan, revision: plan.revision + 1, cursor: plan.cursor + 1 };
    const date = nextDate(plan.date);
    return { ...plan, revision: plan.revision + 1, cursor: 0, date,
        status: validDate(date) ? 'active' : 'completed' };
}
