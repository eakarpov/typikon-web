import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { filterOf } from '@/lib/temples';
import { MyTempleError, validTempleSlug, type AccountTemple, type MyTempleValue } from './core';

async function templeValue(corpus: Db, slug: string): Promise<MyTempleValue | null> {
    const row = await corpus.collection('temples').findOne({ ...filterOf({}), slug }, { projection: { slug: 1, name: 1, place: 1 } });
    return row ? { slug: String(row.slug), name: String(row.name), place: row.place ? String(row.place) : null } : null;
}
function userKey(userId: string) {
    if (!/^[a-f0-9]{24}$/i.test(userId)) throw new MyTempleError('Учётная запись не найдена.', 404);
    return new ObjectId(userId);
}
/** Kept in users, so selecting a temple never grants rights to edit its parish. */
export async function readAccountTemple(userId: string): Promise<AccountTemple> {
    const client = await clientPromise;
    const user = await client.db('typikon-users').collection('users').findOne({ _id: userKey(userId) }, { projection: { myTempleSlug: 1 } });
    if (!user) throw new MyTempleError('Учётная запись не найдена.', 404);
    const initialized = Object.prototype.hasOwnProperty.call(user, 'myTempleSlug');
    const slug = user.myTempleSlug;
    const temple = validTempleSlug(slug) ? await templeValue(client.db('typikon'), slug) : null;
    return { temple, initialized, unavailable: !!slug && !temple };
}
export async function writeAccountTemple(userId: string, choice: { slug: string | null; migrate: boolean }): Promise<AccountTemple> {
    const client = await clientPromise;
    if (choice.slug !== null && !await templeValue(client.db('typikon'), choice.slug)) throw new MyTempleError('Храм не найден в указателе. Выберите другой храм.', 404);
    const users = client.db('typikon-users').collection('users');
    const query = { _id: userKey(userId), ...(choice.migrate ? { myTempleSlug: { $exists: false } } : {}) };
    const result = await users.updateOne(query, { $set: { myTempleSlug: choice.slug } });
    if (!result.matchedCount) {
        if (choice.migrate) { await readAccountTemple(userId); throw new MyTempleError('В учётной записи уже есть выбор. Обновите данные перед переносом.', 409); }
        throw new MyTempleError('Учётная запись не найдена.', 404);
    }
    // Explicit null also blocks a stale legacy import from another device.
    return readAccountTemple(userId);
}
