import type { Db } from 'mongodb';
import { slotsOf, dispatchWaiting } from './priestQueue';
import { reminderDue } from './priestQueueRules';

/** Run every minute. Dry run never changes assignments or delivery state. */
export async function dispatchPriestQueue(db: Db, now: Date,
    send: (token: string, data: Record<string, string>) => Promise<'sent' | 'gone' | 'failed'>,
    dryRun = true) {
    const assigned = dryRun ? 0 : await dispatchWaiting(db, now);
    const slots = slotsOf(db);
    const upcoming = await slots.find({ active: true, reminderEnabled: true,
        startsAt: { $gt: now, $lte: new Date(+now + 3600000) }, reminderSentAt: null }).toArray();
    let due = 0, sent = 0, failed = 0;
    for (const slot of upcoming) {
        if (!reminderDue(slot, now)) continue;
        if (!await db.collection('commemorators').findOne({ userId: slot.userId })) continue;
        due++;
        if (dryRun) continue;
        const claimed = await slots.updateOne({ _id: slot._id, revision: slot.revision,
            $or: [{ reminderLeaseUntil: { $exists: false } }, { reminderLeaseUntil: { $lte: now } }],
        } as any, { $set: { reminderLeaseUntil: new Date(+now + 120000) } } as any);
        if (!claimed.matchedCount) continue;
        const devices = await db.collection('pushDevices').find({ userId: slot.userId }).toArray();
        let delivered = false, retry = false;
        for (const device of devices) {
            // Recheck immediately before sending, including rescheduling/read completion.
            const fresh = await slots.findOne({ _id: slot._id });
            if (!fresh || +fresh.startsAt! !== +slot.startsAt! || !reminderDue(fresh, new Date())) break;
            try {
                const outcome = await send(device.token, { kind: 'priest-queue', serviceId: slot._id });
                if (outcome === 'sent') { sent++; delivered = true; }
                if (outcome === 'failed') { failed++; retry = true; }
                if (outcome === 'gone') await db.collection('pushDevices').deleteOne({ _id: device._id, userId: slot.userId });
            } catch { failed++; retry = true; }
        }
        await slots.updateOne({ _id: slot._id, startsAt: slot.startsAt }, {
            $set: { ...(delivered && !retry ? { reminderSentAt: now } : {}) },
            $unset: { reminderLeaseUntil: '' },
        });
    }
    return { assigned, due, sent, failed };
}
