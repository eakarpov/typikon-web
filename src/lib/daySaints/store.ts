// Собственный каталог дополняет полный календарный снимок Днеслова.
import clientPromise from '@/lib/mongodb';
import { cached, CacheTag, CONTENT_REVALIDATE } from '@/lib/cache';
import { getLinkedSaint } from '@/lib/memories';
import { dneslovDay } from '@/lib/dneslovDay';
import { churchMonthDay, daySaintsOf, mergeDaySaints, type LinkedSaint } from './core';

const linkedDaySaints = cached(async (dateStr: string) => {
    const md = churchMonthDay(dateStr);
    if (!md) return [];
    const db = (await clientPromise).db('typikon');
    const memories = await db.collection('memories')
        .find({ book: 'menaion', month: md.month, day: md.day }, { projection: { _id: 1 } })
        .sort({ _id: 1 }).toArray();
    const linked: LinkedSaint[] = await Promise.all(memories.map(async row => ({
        memoryId: String(row._id), saint: await getLinkedSaint(String(row._id)),
    })));
    return daySaintsOf(linked);
}, ['calendar-linked-saints'], [CacheTag.DAYS, CacheTag.MEMORIES, CacheTag.SAINTS], CONTENT_REVALIDATE);

export async function daySaintsCached(date: string) {
    const [own, external] = await Promise.all([linkedDaySaints(date), dneslovDay(date)]);
    const ids = [...new Set((external.data ?? []).filter((r: any) => r.id != null).map((r: any) => String(r.id)))];
    const db = (await clientPromise).db('typikon');
    const catalogue = ids.length ? await db.collection('saints').find({
        externals: { $elemMatch: { source: 'dneslov', id: { $in: ids } } },
    }).toArray() : [];
    return {
        saints: mergeDaySaints([...own, ...catalogue], external.data ?? []),
        partial: external.data == null,
        sourceStale: external.stale,
    };
}
