import {parishDb} from "./db";
import type {SchedulePeriod} from "./period";
import type {ParishEdit} from "./editModel";
export * from "./editModel";
const collection = async () =>
    (await parishDb()).collection<ParishEdit>("parishEdits");

export const editsOf = async (parishSlug: string, period:SchedulePeriod) =>
    (await collection()).find({ parishSlug, date:{$gte:period.start,$lte:period.end} }).sort({ createdAt: 1 }).toArray();

export const saveEdit = async (edit: Omit<ParishEdit, "_id" | "createdAt">) => {
    const col = await collection();
    // Одна правка на (собрание, действие): вторая правка часа — не вторая
    // запись, а замена первой, иначе история решений станет их спором.
    const _id = `${edit.parishSlug}:${edit.date}:${edit.part}:${edit.op}:${edit.gatheringKey}`;
    const doc = { ...edit, _id, createdAt: new Date() } as ParishEdit;
    await col.replaceOne({ _id } as never, doc as never, { upsert: true });
    return _id;
};

export const dropEdit = async (parishSlug:string,id: string) =>
    (await collection()).deleteOne({ _id: id,parishSlug });
