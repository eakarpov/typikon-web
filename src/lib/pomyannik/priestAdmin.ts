import { ObjectId, type Db } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { DirectGrantError, parsePriestDetails } from './directGrantRules';
const fields = ['rank','name','title','diocese','dioceseUrl','place','about','donationDetails'] as const;
const identity = (p: any) => Object.fromEntries(fields.map(k => [k, p[k] ?? '']));
export async function listPriests(db: Db, q = '', offset = 0, limit = 50) {
    const filter: any = {};
    if (q) {
        const re = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const accounts = await db.collection('users').find({ $or: ['name','surname','email'].map(k => ({[k]: {$regex: re, $options: 'i'}})) },
            {projection: {_id: 1}}).limit(200).toArray();
        filter.$or = ['title','name','diocese','place','userId'].map(k => ({[k]: {$regex: re, $options: 'i'}}));
        filter.$or.push({userId: {$in: accounts.map(a => String(a._id))}});
    }
    const col = db.collection('commemorators');
    const [total, rows] = await Promise.all([col.countDocuments(filter), col.find(filter).sort({title: 1, userId: 1}).skip(offset).limit(limit).toArray()]);
    const ids = rows.map(p => p.userId).filter(id => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id));
    const users = await db.collection('users').find({_id: {$in: ids.map(id => new ObjectId(id))}}, {projection: {name:1,surname:1,email:1}}).toArray();
    return {total, offset, limit, priests: rows.map(p => {
        const u = users.find(u => String(u._id) === p.userId);
        return {userId: p.userId, ...identity(p), accountName: u ? [u.name,u.surname].filter(Boolean).join(' ') : '',
            accountEmail: u?.email ?? '', accountExists: !!u};
    })};
}
export async function updatePriestIdentity(db: Db, actorId: string, raw: any) {
    const userId = raw?.userId;
    if (typeof userId !== 'string' || !/^[a-f0-9]{24}$/i.test(userId) || !await db.collection('users').findOne({_id: new ObjectId(userId)}, {projection:{_id:1}}))
        throw new DirectGrantError('Аккаунт не найден', 404);
    const details = parsePriestDetails(raw);
    const reason = typeof raw.reason === 'string' ? raw.reason.trim() : '';
    if (!reason || reason.length > 1000) throw new DirectGrantError('Укажите основание изменения (до 1000 символов)');
    const at = new Date();
    // Existing priests only. Approval, account roles and intake settings are never changed here.
    const before = await db.collection('commemorators').findOneAndUpdate({userId}, {$set: {...details, identityUpdatedAt: at}}, {returnDocument:'before'});
    if (!before) throw new DirectGrantError('Иерей не найден', 404);
    await db.collection<any>('commemoratorIdentityEdits').insertOne({_id: randomUUID(), userId, by: actorId, at, reason, before:identity(before), after:details});
    return {userId, ...details};
}
