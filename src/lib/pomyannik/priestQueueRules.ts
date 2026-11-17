/** The load unit is a name, and a note is always assigned whole. */
export const SERVICE_KINDS = ['proskomidia', 'panihida', 'moleben'] as const;
export type ServiceKind = typeof SERVICE_KINDS[number];
export const SERVICE_LABELS: Record<ServiceKind, string> = {
    proskomidia: 'Литургия', panihida: 'Панихида', moleben: 'Молебен',
};
export interface ServiceSettings {
    kind: ServiceKind; enabled: boolean; namesLimit: number;
    startsAt: Date | null; timeZone: string; reminderEnabled: boolean;
}
export type ReadingPhase = 'living' | 'departed';
export interface ReservationPart { namesCount: number; readAt: Date | null }
export interface Reservation {
    noteId: string; sourceNoteId?: string; namesCount: number; readAt: Date | null; extra: boolean;
    parts?: Partial<Record<ReadingPhase, ReservationPart>>;
}
export interface ServiceSlot extends ServiceSettings {
    _id: string; userId: string; active: boolean; readyAt: Date;
    entries: Reservation[]; revision: number;
    status?: 'scheduled' | 'reading' | 'finished' | 'expired';
    editableUntil?: Date;
    flowVersion?: 2; readingPhase?: ReadingPhase; readingMode?: 'batch' | 'extra';
    startedAt?: Date; expiresAt?: Date; finishedAt?: Date;
    reminderSentAt?: Date | null; lastAssignedAt?: Date | null;
}
export class QueueError extends Error {
    constructor(message: string, public code: 'bad_request' | 'conflict' = 'bad_request') { super(message); }
}
export function parseSettings(raw: any, now = new Date()): ServiceSettings {
    if (!SERVICE_KINDS.includes(raw?.kind)) throw new QueueError('Неизвестный вид службы');
    if (typeof raw.enabled !== 'boolean' || typeof raw.reminderEnabled !== 'boolean')
        throw new QueueError('Укажите настройки приёма и напоминания');
    if (!Number.isInteger(raw.namesLimit) || raw.namesLimit < 1 || raw.namesLimit > 10000)
        throw new QueueError('Лимит должен быть целым числом от 1 до 10000');
    const timeZone = String(raw.timeZone ?? '');
    try { new Intl.DateTimeFormat('ru', { timeZone }).format(); }
    catch { throw new QueueError('Неизвестный часовой пояс'); }
    const startsAt = raw.startsAt ? new Date(raw.startsAt) : null;
    if (startsAt && !Number.isFinite(+startsAt)) throw new QueueError('Не удалось разобрать дату службы');
    if (raw.enabled && raw.policyOnly !== true && (!startsAt || startsAt <= now)) throw new QueueError('Укажите будущие дату и время службы');
    return { kind: raw.kind, enabled: raw.enabled, namesLimit: raw.namesLimit,
        startsAt, timeZone, reminderEnabled: raw.reminderEnabled };
}
export const usedNames = (s: Pick<ServiceSlot, 'entries'>) =>
    s.entries.reduce((sum, e) => sum + e.namesCount, 0);
export function rankSlots(slots: ServiceSlot[]): ServiceSlot[] {
    return [...slots].sort((a, b) => +a.startsAt! - +b.startsAt!
        || usedNames(a) / a.namesLimit - usedNames(b) / b.namesLimit
        || +(a.lastAssignedAt ?? 0) - +(b.lastAssignedAt ?? 0)
        || a._id.localeCompare(b._id));
}
export function fits(s: ServiceSlot, count: number, now: Date) {
    return s.active && s.status !== 'reading' && s.status !== 'finished' && s.status !== 'expired' && s.enabled && !!s.startsAt && s.startsAt > now && s.readyAt <= now
        && usedNames(s) + count <= s.namesLimit;
}
export function reminderDue(s: ServiceSlot, now: Date) {
    return s.active && s.status !== 'reading' && s.status !== 'finished' && s.status !== 'expired' && s.reminderEnabled && !s.reminderSentAt && !!s.startsAt
        && s.startsAt > now && +s.startsAt - +now <= 3600000
        && s.entries.some(e => !e.readAt);
}
