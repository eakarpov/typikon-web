import { ObjectId, type Collection } from "mongodb";
export type TrashStore = Pick<Collection, "findOne" | "countDocuments" | "updateOne">;
export class TrashLimitError extends Error {}

export const moveToTrash = async (store: TrashStore, userId: string, id: string, now = new Date()) => {
    if (!ObjectId.isValid(id)) return false;
    const result = await store.updateOne({ _id: new ObjectId(id), userId, deletedAt: null },
        { $set: { deletedAt: now, updatedAt: now } });
    return result.modifiedCount > 0;
};
export const recoverFromTrash = async (store: TrashStore, userId: string, id: string, limit: number, now = new Date()) => {
    if (!ObjectId.isValid(id)) return false;
    const filter = { _id: new ObjectId(id), userId, deletedAt: { $type: "date" as const } };
    if (!await store.findOne(filter)) return false;
    if (await store.countDocuments({ userId, deletedAt: null }) >= limit) throw new TrashLimitError();
    const last = await store.findOne({ userId, deletedAt: null }, { sort: { order: -1 }, projection: { order: 1 } });
    const result = await store.updateOne(filter, { $unset: { deletedAt: "" },
        $set: { order: (last?.order ?? 0) + 1, updatedAt: now } });
    return result.modifiedCount > 0;
};
