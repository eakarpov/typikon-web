import { createHash } from 'node:crypto';
import type { Db } from 'mongodb';
import type { ReadingPlan } from './core';
import { duePlanReminder } from './reminders';
export interface PlanDelivery {
    _id: string;
    userId: string;
    planId: string;
    date: string;
    reminderVersion: string;
    createdAt: Date;
    status: 'sending' | 'sent' | 'failed' | 'cancelled';
}
export const PLAN_DELIVERIES = 'readingPlanDeliveries';
/** Atomic per-device/day claim. Transport failures are recorded, never converted into next-day debts. */
export async function dispatchPlanReminders(db: Db, now: Date, send: (token: string, data: Record<string, string>) => Promise<'sent' | 'failed' | 'gone'>, dryRun = true) {
    const out = { plans: 0, devices: 0, sent: 0, failed: 0, cancelled: 0, duplicates: 0 };
    const plans = db.collection<ReadingPlan & {
        _id: string;
    }>('readingPlans'), deliveries = db.collection<PlanDelivery>(PLAN_DELIVERIES);
    for await (const plan of plans.find({ status: 'active', 'reminder.enabled': true })) {
        const date = duePlanReminder(plan, now);
        if (!date || !plan.reminder?.version)
            continue;
        if (plan.kind === 'book' && !plan.units[plan.cursor])
            continue;
        out.plans++;
        for await (const device of db.collection('pushDevices').find({ userId: plan._id, readingPlanCapable: true })) {
            if (typeof device.token !== 'string' || !device.token)
                continue;
            out.devices++;
            if (dryRun)
                continue;
            const id = createHash('sha256').update(`${plan.id}\0${date}\0${device.token}`).digest('hex');
            try {
                await deliveries.insertOne({ _id: id, userId: plan._id, planId: plan.id, date, reminderVersion: plan.reminder.version, createdAt: now, status: 'sending' });
            }
            catch (e) {
                if ((e as {
                    code?: number;
                }).code === 11000) {
                    out.duplicates++;
                    continue;
                }
                throw e;
            }
            // Recheck immediately before transport: pause/delete/settings change cancels the queued signal.
            const fresh = await plans.findOne({ _id: plan._id, id: plan.id, status: 'active', 'reminder.version': plan.reminder.version, 'reminder.enabled': true });
            const stillOwned = await db.collection('pushDevices').findOne({ _id: device._id, userId: plan._id, token: device.token, readingPlanCapable: true });
            if (!fresh || !stillOwned || duePlanReminder(fresh, now) !== date) {
                await deliveries.updateOne({ _id: id }, { $set: { status: 'cancelled' } });
                out.cancelled++;
                continue;
            }
            let status: 'sent' | 'failed' = 'failed';
            try {
                const result = await send(device.token, { kind: 'reading-plan', deliveryId: id });
                if (result === 'sent')
                    status = 'sent';
                if (result === 'gone')
                    await db.collection('pushDevices').deleteOne({ _id: device._id, userId: plan._id, token: device.token });
            }
            catch { /* Never log a device token or push credential. */ }
            await deliveries.updateOne({ _id: id }, { $set: { status } });
            out[status]++;
        }
    }
    return out;
}
