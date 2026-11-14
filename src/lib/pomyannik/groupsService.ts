import { orderedGroups, validateGroupOrder } from './groupPriority';
import { addGroupMembers } from "./groupMembers";
import { groupIdentity, planGroupMigration } from "./groupMigration";
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { GroupError, groupIds, groupKey, groupName, type PomyannikGroup } from './groups';
const database = async () => (await clientPromise).db('typikon-users');
let groupIndex: Promise<string> | undefined;
const registry = async () => {
    const collection = (await database()).collection<{
        _id: string;
        userId: string;
        name: string;
        key: string;
        createdAt: Date;
    }>('pomyannikGroups');
    groupIndex ??= collection.createIndex({ userId: 1, key: 1 }, { unique: true, name: 'owner_group_name' }).catch(error => {
        groupIndex = undefined;
        throw error;
    });
    await groupIndex;
    return collection;
};
const migrations = new Map<string, Promise<void>>();
/** Однократный перенос существующих строковых групп. Дальнейшие API принимают только ID. */
export async function ensureGroupMigration(userId: string): Promise<void> {
    if (migrations.has(userId))
        return migrations.get(userId)!;
    const migration = (async () => {
        const db = await database(), settings = db.collection<{
            _id: string;
            groupsVersion?: number;
            commemorations?: Record<string, any>;
            readingPlace?: any;
        }>('pomyannikSettings');
        const stored = await settings.findOne({ _id: userId });
        if (stored?.groupsVersion === 1)
            return;
        const persons = db.collection('pomyannikPersons'), collection = await registry();
        const [docs, existing] = await Promise.all([persons.find({ userId, groupsSchemaVersion: { $ne: 1 } }).toArray(), collection.find({ userId }).toArray()]);
        const plan = planGroupMigration(userId, docs.map(p => ({ id: String(p._id), groups: p.groups, groupsSchemaVersion: p.groupsSchemaVersion })), stored ?? {}, existing.map(g => ({ id: g._id, name: g.name, key: g.key })));
        if (plan.groups.length)
            await collection.bulkWrite(plan.groups.map(g => ({ updateOne: { filter: { _id: g.id, userId }, update: { $setOnInsert: { _id: g.id, userId, name: g.name, key: g.key, createdAt: new Date() } }, upsert: true } })));
        const updates = plan.updates.map(p => ({ updateOne: { filter: { _id: new ObjectId(p.id), userId, groupsSchemaVersion: { $ne: 1 }, ...(Array.isArray(p.previous) ? { groups: p.previous } : { groups: { $exists: false } }) }, update: { $set: { groups: p.groups, groupsSchemaVersion: 1 } } } }));
        if (updates.length)
            await persons.bulkWrite(updates);
        if (await persons.countDocuments({ userId, groupsSchemaVersion: { $ne: 1 } }))
            throw new GroupError("Группы изменились во время переноса. Повторите загрузку.");
        await settings.updateOne({ _id: userId }, { $setOnInsert: { _id: userId } }, { upsert: true });
        await settings.updateOne({ _id: userId, groupsVersion: { $ne: 1 } }, { $set: plan.fields });
    })();
    migrations.set(userId, migration);
    try {
        await migration;
    }
    finally {
        migrations.delete(userId);
    }
}
export async function listGroups(userId: string): Promise<PomyannikGroup[]> {
    await ensureGroupMigration(userId);
    const groups=(await (await registry()).find({ userId }).sort({ name: 1 }).toArray()).map(g=>({id:g._id,name:g.name}));
    const settings=await (await database()).collection<{_id:string;groupOrder?:string[]}>('pomyannikSettings').findOne({_id:userId});
    return orderedGroups(groups,settings?.groupOrder??[]);
}
export async function createGroup(userId: string, raw: unknown): Promise<PomyannikGroup> {
    const name = groupName(raw);
    await ensureGroupMigration(userId);
    const collection = await registry(), id = groupIdentity(userId, name);
    await collection.updateOne({ _id: id, userId }, { $setOnInsert: { _id: id, userId, name, key: groupKey(name), createdAt: new Date() } }, { upsert: true });
    const group = await collection.findOne({ _id: id, userId });
    return { id: group!._id, name: group!.name };
}
export async function assertOwnGroups(userId: string, raw: unknown): Promise<string[]> {
    const ids = groupIds(raw);
    await ensureGroupMigration(userId);
    if (ids.length && await (await registry()).countDocuments({ _id: { $in: ids }, userId }) !== ids.length)
        throw new GroupError('Группа не найдена в вашем помяннике. Обновите страницу.');
    return ids;
}
/** Меняем только связи. Даты, имена, чины и существующие группы не перезаписываются. */
export async function addPersonsToGroup(userId: string, groupId: unknown, rawIds: unknown) {
    const [ownedGroup] = await assertOwnGroups(userId, [groupId]);
    return addGroupMembers((await database()).collection('pomyannikPersons'), userId, ownedGroup, rawIds);
}

export async function reorderGroups(userId:string, raw:unknown):Promise<void> {
    const order=validateGroupOrder(raw,await listGroups(userId));
    await (await database()).collection<{_id:string;groupOrder?:string[]}>('pomyannikSettings')
        .updateOne({_id:userId},{$set:{groupOrder:order}},{upsert:true});
}
