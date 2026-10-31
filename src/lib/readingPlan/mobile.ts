import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { readPlan } from './service';
import { readingParts } from '@/lib/readingParts';
import { duePlanReminder } from './reminders';
import { PLAN_DELIVERIES, type PlanDelivery } from './dispatch';
export async function mobileReadingPlan(userId: string) {
    const plan = await readPlan(userId);
    if (!plan)
        return null;
    const unit = plan.status === 'completed' ? null : plan.current;
    let content: string | null = null, footnotes: string[] = [], markdown = false, csSource = false;
    if (unit?.textId) {
        const db = (await clientPromise).db('typikon');
        const t = await db.collection('texts').findOne({ _id: new ObjectId(unit.textId) });
        const hidden = t?.bookId ? await db.collection('books').findOne({ _id: t.bookId, public: false }) : null;
        if (t && !hidden && typeof t.content === 'string') {
            content = unit.statia ? readingParts(t.content)[unit.statia - 1] ?? null : t.content;
            footnotes = Array.isArray(t.footnotes) ? t.footnotes.filter((x: unknown) => typeof x === 'string') : [];
            markdown = t.newUi === true;
            csSource = t.csSource === true;
        }
    }
    else if (unit?.pericope) {
        csSource = true;
        const p = unit.pericope;
        content = p.liturgicalText?.content ?? (p.verses ?? []).map((v: {
            chapter: number;
            verse: number;
            content: string;
        }) => `${v.chapter}:${v.verse} ${v.content}`).join('\n\n');
    }
    return { userId, id: plan.id, revision: plan.revision, title: plan.title, status: plan.status, reminder: plan.reminder ?? null, reminderDevices: plan.reminderDevices,
        current: unit ? { title: unit.title, href: unit.href, content, footnotes, markdown, csSource } : null };
}
export async function readingPlanNotice(userId: string, id: string, now = new Date()) {
    if (!/^[a-f0-9]{64}$/.test(id))
        return null;
    const db = (await clientPromise).db('typikon-users');
    const delivery = await db.collection<PlanDelivery>(PLAN_DELIVERIES).findOne({ _id: id, userId, status: { $in: ['sending', 'sent'] } });
    if (!delivery || now.getTime() - delivery.createdAt.getTime() > 3600000 || now < delivery.createdAt)
        return null;
    const plan = await db.collection('readingPlans').findOne({ _id: userId as never, id: delivery.planId, status: 'active', 'reminder.enabled': true, 'reminder.version': delivery.reminderVersion });
    if (!plan || duePlanReminder(plan as never, now) !== delivery.date)
        return null;
    const current = await mobileReadingPlan(userId);
    if (!current || current.status !== 'active' || current.id !== delivery.planId || !current.current)
        return null;
    if (!await db.collection('readingPlans').findOne({ _id: userId as never, id: delivery.planId, status: 'active', 'reminder.enabled': true, 'reminder.version': delivery.reminderVersion }))
        return null;
    return { userId, planId: current.id, deliveryId: id, title: 'Личный план чтения', body: current.current.title };
}
