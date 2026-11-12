import { ObjectId, type Collection } from 'mongodb';
import { GroupError, selectedPersonIds } from './groups';
type Store = Pick<Collection, 'countDocuments' | 'updateMany' | 'find'>;
/** groupId уже проверен по реестру владельца. В каждой операции сохраняется область userId. */
export async function addGroupMembers(store: Store, userId: string, groupId: string, rawIds: unknown) {
    const ids = selectedPersonIds(rawIds), filter = { userId, deletedAt: null, _id: { $in: ids.map(id => new ObjectId(id)) } };
    if (await store.countDocuments(filter) !== ids.length)
        throw new GroupError('Список изменился или содержит недоступные записи. Обновите помянник.');
    const updated = await store.updateMany({ ...filter, groups: { $ne: groupId }, $expr: { $lt: [{ $size: { $ifNull: ['$groups', []] } }, 10] } }, { $addToSet: { groups: groupId }, $set: { updatedAt: new Date() } });
    const items = (await store.find(filter, { projection: { groups: 1 } }).toArray()).map(p => ({ id: String(p._id), groups: p.groups as string[] }));
    const included = new Set(items.filter(p => p.groups.includes(groupId)).map(p => p.id));
    return { items, added: updated.modifiedCount, skipped: ids.filter(id => !included.has(id)) };
}
