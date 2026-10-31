import {parsePlanReminder} from './reminders';
import { randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { getMovableDay } from '@/lib/calcDay';
import { resolveDayPericopes } from '@/lib/pericopes';
import { DEFAULT_BIBLE_LANGUAGE } from '@/utils/bibleLanguage';
import { readingParts } from '@/lib/readingParts';
import { PlanError, advancePlan, validDate, type ReadingPlan, type PlanUnit } from './core';
const collection = async () => (await clientPromise).db('typikon-users').collection<ReadingPlan & {
    _id: string;
}>('readingPlans');
export async function planOptions() {
    const db = (await clientPromise).db('typikon');
    const ids = await db.collection('texts').distinct('bookId', { content: { $type: 'string', $ne: '' } });
    return (await db.collection('books').find({ _id: { $in: ids }, public: { $ne: false } }, { projection: { name: 1 } }).sort({ order: 1, name: 1 }).toArray())
        .map(b => ({ id: String(b._id), name: String(b.name) }));
}
export async function planUnits(plan: ReadingPlan): Promise<PlanUnit[]> {
    if (plan.kind === 'book')
        return plan.units;
    const db = (await clientPromise).db('typikon');
    const { triodicDay } = await getMovableDay(plan.date);
    if (!triodicDay)
        return [];
    const day = await resolveDayPericopes(db, triodicDay, DEFAULT_BIBLE_LANGUAGE);
    return ['apostleLiturgy', 'gospelLiturgy'].flatMap(slot => (day?.[slot]?.items ?? []).filter((i: any) => i.pericope).map((i: any, n: number) => ({
        key: `${plan.date}:${slot}:${n}`, title: i.pericope.label || slot,
        href: `/reading-plan#plan-current-reading`, slot, pericope: i.pericope,
    })));
}
export async function readPlan(userId: string) {
    const doc = await (await collection()).findOne({ _id: userId });
    if (!doc)
        return null;
    const { _id, ...plan } = doc;
    const units = await planUnits(plan);
    const unit = units[plan.cursor];
    if (unit?.textId && !unit.statia) {
        const mark = await (await clientPromise).db('typikon-users').collection('readingProgress').findOne({ userId, textId: unit.textId });
        if (mark && Number.isInteger(mark.paragraph) && mark.paragraph >= 0 && mark.paragraph < mark.total - 1)
            units[plan.cursor] = { ...unit, href: unit.href.split('#')[0] + `#par-${mark.paragraph}` };
    }
    const devices=await(await clientPromise).db('typikon-users').collection('pushDevices').countDocuments({userId,readingPlanCapable:true});
    return { ...plan, units, current: units[plan.cursor] ?? null, reminderDevices:devices };
}
export async function createPlan(userId: string, body: Record<string, unknown>) {
    if (!validDate(body.date) || !['book', 'lectionary'].includes(String(body.kind)))
        throw new PlanError('Проверьте вид плана и дату начала.');
    let units: PlanUnit[] = [];
    let title = 'По рядовым зачалам';
    if (body.kind === 'book') {
        if (typeof body.bookId !== 'string' || !/^[a-f0-9]{24}$/i.test(body.bookId))
            throw new PlanError('Выберите книгу.');
        const db = (await clientPromise).db('typikon');
        const bookId = new ObjectId(body.bookId);
        const book = await db.collection('books').findOne({ _id: bookId, public: { $ne: false } });
        if (!book)
            throw new PlanError('Книга не найдена.');
        const texts = await db.collection('texts').find({ bookId, content: { $type: 'string', $ne: '' } }, { projection: { name: 1, alias: 1, content: 1 } }).sort({ bookIndex: 1, _id: 1 }).limit(4001).toArray();
        if (texts.length > 4000)
            throw new PlanError('Книга слишком велика для одного плана.');
        units = texts.flatMap(t => readingParts(t.content).map((part, n, all) => ({ part, n, all })).filter(p => p.part.trim()).map(({ n, all }) => ({
            key: `${t._id}:${n + 1}`, title: `${t.name || 'Чтение'}${all.length > 1 ? ` · статия ${n + 1}` : ''}`,
            textId: String(t._id), ...(all.length > 1 ? { statia: n + 1 } : {}), href: `/reading/${t.alias || t._id}${all.length > 1 ? `?statia=${n + 1}` : ''}`,
        })));
        if (!units.length || units.length > 10000)
            throw new PlanError('В книге нет доступных чтений или она слишком велика для одного плана.');
        title = String(book.name);
    }
    const plan: ReadingPlan = { id: randomUUID(), revision: 0, kind: body.kind as ReadingPlan['kind'], title, status: 'active', cursor: 0, date: body.date, units };
    await (await collection()).insertOne({ _id: userId, ...plan });
}
export async function changePlan(userId: string, body: Record<string, unknown>) {
    const col = await collection();
    const plan = await col.findOne({ _id: userId });
    if (!plan || body.id !== plan.id || body.revision !== plan.revision)
        throw new PlanError('План изменился. Обновите страницу.');
    let next: ReadingPlan;
    if(body.action==='reminder') {
        const reminder=parsePlanReminder(body.reminder);
        if(!reminder)throw new PlanError('Выберите время, дни недели и часовой пояс.');
        if(plan.status==='completed'&&reminder.enabled)throw new PlanError('План завершён. Создайте новый план для напоминаний.');
        next={...plan,reminder:{...reminder,version:randomUUID()},revision:plan.revision+1};
    }
    else if (body.action === 'advance')
        next = advancePlan(plan, (await planUnits(plan)).length);
    else if (body.action === 'pause' && plan.status === 'active')
        next = { ...plan, status: 'paused', revision: plan.revision + 1 };
    else if (body.action === 'resume' && plan.status === 'paused')
        next = { ...plan, status: 'active', revision: plan.revision + 1 };
    else
        throw new PlanError('Недоступное действие.');
    const { _id, ...stored } = next as ReadingPlan & {
        _id?: string;
    };
    const result = await col.updateOne({ _id: userId, id: plan.id, revision: plan.revision }, { $set: stored });
    if (!result.matchedCount)
        throw new PlanError('План изменился. Обновите страницу.');
}
export async function deletePlan(userId: string, id: string) { await (await collection()).deleteOne({ _id: userId, id }); }
