import { randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { readingParts } from '@/lib/readingParts';
import { CollectionError, collectionRefs, collectionTitle, type ReadingCollection, type ReadingRef, type CollectionItem } from './core';
type Doc = ReadingCollection & {
    _id: string;
    userId: string;
};
const db = async () => (await clientPromise).db('typikon-users');
const own = async () => (await db()).collection<Doc>('readingCollections');
export async function listCollections(userId: string) { return (await (await own()).find({ userId }, { projection: { _id: 0, userId: 0 } }).sort({ title: 1 }).limit(100).toArray()) as ReadingCollection[]; }
export async function resolveCollectionItems(refs: ReadingRef[]): Promise<CollectionItem[]> {
    const corpus = (await clientPromise).db('typikon');
    const rows = await corpus.collection('texts').find({ _id: { $in: refs.map(r => new ObjectId(r.textId)) } }, { projection: { name: 1, alias: 1, content: 1, bookId: 1 } }).toArray();
    const hidden = new Set((await corpus.collection('books').find({ public: false }, { projection: { _id: 1 } }).toArray()).map(b => String(b._id)));
    const byId = new Map(rows.map(t => [String(t._id), t]));
    return refs.map(r => {
        const t = byId.get(r.textId);
        if (!t || !t.content?.trim() || hidden.has(String(t.bookId)))
            throw new CollectionError('Текст недоступен для подборки.');
        const parts = readingParts(t.content);
        if (r.statia !== undefined && (!parts[r.statia - 1]?.trim()))
            throw new CollectionError('В тексте нет такой статии.');
        return { ...r, title: `${t.name || 'Чтение'}${r.statia !== undefined ? ` · статия ${r.statia}` : ''}`, href: `/reading/${t.alias || t._id}${r.statia !== undefined ? `?statia=${r.statia}` : ''}` };
    });
}
export async function editCollection(userId: string, b: Record<string, unknown>) {
    const col = await own();
    if (b.action === 'create') {
        if (await col.countDocuments({ userId }) >= 100)
            throw new CollectionError('Можно сохранить до 100 подборок.');
        const id = randomUUID();
        await col.insertOne({ _id: id, id, userId, revision: 0, title: collectionTitle(b.title), items: [] });
        return id;
    }
    if (typeof b.id !== 'string' || !Number.isInteger(b.revision))
        throw new CollectionError('Обновите список подборок.');
    const row = await col.findOne({ _id: b.id, userId, revision: b.revision as number });
    if (!row)
        throw new CollectionError('Подборка изменилась или недоступна. Обновите страницу.');
    if (b.action === 'delete') {
        const result = await col.deleteOne({ _id: row.id, userId, revision: row.revision });
        if (!result.deletedCount)
            throw new CollectionError('Подборка изменилась.');
        await (await db()).collection('readingCollectionShares').deleteMany({ collectionId: row.id, userId });
        return row.id;
    }
    if (b.action === 'publish') {
        if (!row.items.length)
            throw new CollectionError('Добавьте хотя бы одно чтение.');
        const token = randomUUID();
        const items = await resolveCollectionItems(row.items);
        await (await db()).collection('readingCollectionShares').insertOne({ _id: token as never, userId, collectionId: row.id, title: row.title, items, createdAt: new Date() });
        if (!await col.findOne({ _id: row.id, userId, revision: row.revision })) {
            await (await db()).collection('readingCollectionShares').deleteOne({ _id: token as never, userId });
            throw new CollectionError('Подборка изменилась. Опубликуйте актуальную копию.');
        }
        return token;
    }
    if (b.action === 'unpublish') {
        await (await db()).collection('readingCollectionShares').deleteMany({ collectionId: row.id, userId });
        return row.id;
    }
    const refs = b.action === 'append' ? collectionRefs([...row.items, ...collectionRefs([b.item])]) : collectionRefs(b.items);
    const items = await resolveCollectionItems(refs), title = b.title === undefined ? row.title : collectionTitle(b.title);
    const r = await col.updateOne({ _id: row.id, userId, revision: row.revision }, { $set: { title, items }, $inc: { revision: 1 } });
    if (!r.matchedCount)
        throw new CollectionError('Подборка изменилась. Обновите страницу.');
    return row.id;
}
export async function sharedCollection(token: string): Promise<{
    title: string;
    items: CollectionItem[];
} | null> {
    if (!/^[a-f0-9-]{36}$/.test(token))
        return null;
    const row = await (await db()).collection('readingCollectionShares').findOne({ _id: token as never });
    return row ? { title: String(row.title), items: row.items as CollectionItem[] } : null;
}
