import clientPromise from '@/lib/mongodb';
import type { Memory } from '@/lib/memories';
import { parishDb } from './db';
import type { DayConfig } from './dayConfig';
export const dayConfigs = async (slug: string, from: string, to: string) => (await parishDb()).collection<DayConfig & {
    parishSlug: string;
}>('parishDays').find({ parishSlug: slug, date: { $gte: from, $lte: to } }).toArray();
export const saveDayConfig = async (slug: string, config: DayConfig, userId: string) => {
    const col = (await parishDb()).collection('parishDays');
    if (!config.memories.length && !config.sign && !config.morningLiturgies) {
        await col.deleteOne({ _id: `${slug}:${config.date}` } as never);
        return;
    }
    await col.updateOne({ _id: `${slug}:${config.date}` } as never, { $set: { ...config, parishSlug: slug, updatedAt: new Date(), updatedBy: userId }, ...(!config.morningLiturgies?{$unset:{morningLiturgies:""}}:{}) }, { upsert: true });
};
/** Без вложенного Next cache: вызывается из кэшируемой сборки периода. */
export const memoryMetadata = async (ids: string[]) => {
    const rows = await (await clientPromise).db('typikon').collection('memories').find({ _id: { $in: [...new Set(ids)] } } as never, { projection: { memoryId: 1, label: 1, book: 1, 'sign.default': 1 } }).toArray();
    return new Map(rows.map(row => [String(row._id), row as unknown as Memory]));
};
