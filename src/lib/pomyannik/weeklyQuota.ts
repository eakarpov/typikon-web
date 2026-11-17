import { ObjectId, type Db } from 'mongodb';
import { NoteError } from './note';
import { insertNoteSnapshot, priorSubmission, type NoteSubmission } from './priestSubmissions';

interface WeeklyUsage { _id: string; used: number; periodEnd?: Date; pending?: Array<{ id: ObjectId; count: number; at: Date }> }

export interface WeeklyPolicy { namesLimit: number; resetDay: number; resetHour: number; resetMinute: number }
export const DEFAULT_WEEKLY_POLICY: WeeklyPolicy = { namesLimit: 20, resetDay: 7, resetHour: 15, resetMinute: 0 };
// Day: ISO weekday (Monday = 1). Schedule is always Europe/Moscow (UTC+3).
export function parseWeeklyPolicy(raw: any): WeeklyPolicy {
    const result = {} as WeeklyPolicy;
    for (const [key, min, max] of [['namesLimit', 1, 100000], ['resetDay', 1, 7], ['resetHour', 0, 23], ['resetMinute', 0, 59]] as const) {
        if (!Number.isInteger(raw?.[key]) || raw[key] < min || raw[key] > max)
            throw new NoteError('Укажите корректные лимит, день и время сброса');
        result[key] = raw[key];
    }
    return result;
}
export async function weeklyPolicy(db: Db): Promise<WeeklyPolicy> {
    const doc = await db.collection('pomyannikPolicies').findOne({ key: 'weeklyNames' });
    return doc ? parseWeeklyPolicy(doc) : { ...DEFAULT_WEEKLY_POLICY };
}
export async function saveWeeklyPolicy(db: Db, raw: unknown, actorId: string) {
    const policy = parseWeeklyPolicy(raw);
    await db.collection('pomyannikPolicies').createIndex({ key: 1 }, { unique: true });
    await db.collection('pomyannikPolicies').updateOne({ key: 'weeklyNames' },
        { $set: { ...policy, updatedAt: new Date(), updatedBy: actorId } }, { upsert: true });
    return policy;
}
export function weeklyWindow(policy: WeeklyPolicy, now = new Date()) {
    const local = new Date(+now + 3 * 3600000);
    const day = local.getUTCDay() || 7;
    const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(),
        local.getUTCDate() - (day - policy.resetDay + 7) % 7, policy.resetHour - 3, policy.resetMinute));
    if (+start > +now) start.setUTCDate(start.getUTCDate() - 7);
    return { start, end: new Date(+start + 7 * 86400000) };
}
async function sentCount(db: Db, userId: string, start: Date, end: Date) {
    const [row] = await db.collection('zapiski').aggregate([
        { $match: { fromUserId: userId, createdAt: { $gte: start, $lt: end } } },
        { $group: { _id: null, used: { $sum: '$namesCount' } } },
    ]).toArray();
    return Number(row?.used ?? 0);
}
// Recover an interrupted reservation after its bounded write has finished.
async function recoverReservations(db: Db, key: string) {
    const counters = db.collection<WeeklyUsage>('pomyannikWeeklyUsage');
    const row = await counters.findOne({ _id: key });
    for (const pending of row?.pending ?? []) {
        if (+new Date(pending.at) > Date.now() - 5 * 60000) continue;
        const inserted = await db.collection('zapiski').findOne({ _id: pending.id }, { projection: { _id: 1 } });
        await counters.updateOne({ _id: key, 'pending.id': pending.id }, {
            $pull: { pending: { id: pending.id } },
            ...(inserted ? {} : { $inc: { used: -pending.count } }),
        });
    }
}
export async function weeklyQuota(db: Db, userId: string, now = new Date()) {
    const policy = await weeklyPolicy(db), { start, end } = weeklyWindow(policy, now);
    await recoverReservations(db, `${userId}:${start.toISOString()}`);
    const used = await sentCount(db, userId, start, end);
    return { ...policy, used, remaining: Math.max(0, policy.namesLimit - used),
        periodStart: start.toISOString(), resetsAt: end.toISOString(), timeZone: 'Europe/Moscow' };
}
export class WeeklyQuotaError extends NoteError {}

/** Atomic capacity reservation works on standalone MongoDB as well as replica sets.
 * Counters hold no names; history includes swept/read notes and all recipients/kinds.
 */
export async function insertWithinWeeklyQuota(db: Db, note: any, submission?: NoteSubmission) {
    if (submission) {
        const prior = await priorSubmission(db, note.fromUserId, submission);
        if (prior) return prior;
    }
    const policy = await weeklyPolicy(db), { start, end } = weeklyWindow(policy, note.createdAt);
    const counters = db.collection<WeeklyUsage>('pomyannikWeeklyUsage');
    const key = `${note.fromUserId}:${start.toISOString()}`;
    const historical = await sentCount(db, note.fromUserId, start, end);
    try { await counters.updateOne({ _id: key }, { $setOnInsert: { used: historical, periodEnd: end } }, { upsert: true }); }
    catch (e: any) { if (e?.code !== 11000) throw e; }
    await recoverReservations(db, key);
    await counters.updateOne({ _id: key }, { $max: { used: historical } });
    const candidate = { ...note, _id: new ObjectId() };
    const reserved = await counters.findOneAndUpdate({ _id: key, used: { $lte: policy.namesLimit - note.namesCount } },
        { $inc: { used: note.namesCount }, $push: { pending: { id: candidate._id, count: note.namesCount, at: new Date() } } }, { returnDocument: 'after' });
    if (!reserved) {
        // A retry after another request completed is still successful at a full quota.
        const prior = submission ? await priorSubmission(db, note.fromUserId, submission) : null;
        if (prior) return prior;
        throw new WeeklyQuotaError(`Недельный лимит — ${policy.namesLimit} имён. За неделю уже подано ${historical}. Следующий сброс: ${new Date(+end + 3 * 3600000).toISOString().replace('T', ' ').replace('.000Z', ' МСК')}`);
    }
    try {
        const inserted = await insertNoteSnapshot(db, candidate, submission, { timeoutMS: 30000 });
        await counters.updateOne({ _id: key, 'pending.id': candidate._id }, {
            $pull: { pending: { id: candidate._id } },
            ...(String(inserted._id) !== String(candidate._id) ? { $inc: { used: -note.namesCount } } : {}),
        });
        return inserted;
    } catch (e) {
        // An acknowledged failure releases capacity. An ambiguous insert is checked
        // by its predetermined id before releasing, so accepted notes stay counted.
        if (!await db.collection('zapiski').findOne({ _id: candidate._id }))
            await counters.updateOne({ _id: key, 'pending.id': candidate._id }, { $inc: { used: -note.namesCount }, $pull: { pending: { id: candidate._id } } });
        throw e;
    }
}
