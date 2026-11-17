import { ObjectId, type Db } from 'mongodb';
import { newInviteCode, slugOf } from './claim';

import { DirectGrantError, normalizeGrantEmail, parsePriestDetails, type PriestDetails } from './directGrantRules';
export { DirectGrantError } from './directGrantRules';
interface DirectGrantRecord {
    _id: string; details: PriestDetails; reason: string; grantedBy: string;
    updatedAt: Date; createdAt: Date; email: string | null;
    status: 'waiting-login' | 'binding' | 'bound' | 'revoked'; boundUserId: string | null;
    boundAt?: Date; appliedAt?: Date; revokedBy?: string; revokedAt?: Date;
    history: { at: Date; by: string; reason: string; details?: PriestDetails }[];
}
async function applyPriest(db: Db, userId: string, details: PriestDetails, grant: any) {
    const people = db.collection('commemorators');
    await people.createIndex({ userId: 1 }, { unique: true });
    await people.updateOne({ userId }, {
        // Do not replace the document: invite code, slug, service settings and
        // acceptance preferences belong to the priest and survive admin edits.
        $set: { ...details, confirmationMethod: 'administrator', directGrantId: grant._id,
            confirmedBy: grant.grantedBy, confirmedAt: grant.updatedAt },
        $setOnInsert: { userId, public: false, slug: `${slugOf(details.title)}-${newInviteCode().slice(0,6).toLowerCase()}`,
            inviteCode: newInviteCode(), accepts: [], createdAt: new Date() },
    }, { upsert: true });
    // Resolve an existing application without forging an email verification.
    await db.collection('commemoratorClaims').updateOne({ userId }, { $set: { status: 'approved',
        decidedBy: grant.grantedBy, decidedAt: grant.updatedAt, decisionNote: grant.reason,
        confirmationMethod: 'administrator' } });
    return people.findOne({ userId });
}
/** Only called after checking commemoration.grant on the server. No mail is sent. */
export async function grantPriestDirectly(db: Db, adminId: string, raw: any, now = new Date()) {
    const details = parsePriestDetails(raw);
    const reason = typeof raw?.reason === 'string' ? raw.reason.trim() : '';
    if (!reason || reason.length > 1000) throw new DirectGrantError('Укажите основание назначения (до 1000 символов)');
    let target: { userId: string | null; email: string | null; _id: string };
    if (raw.targetType === 'user') {
        const userId = String(raw.userId ?? '');
        if (!/^[a-f0-9]{24}$/i.test(userId) || !await db.collection('users').findOne({ _id: new ObjectId(userId) }))
            throw new DirectGrantError('Выберите существующий аккаунт', 404);
        target = { userId, email: null, _id: `user:${userId}` };
    } else if (raw.targetType === 'email') {
        const email = normalizeGrantEmail(raw.email);
        target = { userId: null, email, _id: `email:${email}` };
    } else throw new DirectGrantError('Выберите аккаунт или назначение по почте Google');
    const col = db.collection<DirectGrantRecord>('commemoratorDirectGrants');
    const current = await col.findOne({ _id: target._id });
    const boundUserId = target.userId ?? current?.boundUserId ?? null;
    const status: DirectGrantRecord['status'] = boundUserId ? 'bound' : 'waiting-login';
    const result = await col.findOneAndUpdate({ _id: target._id }, {
        $set: { details, reason, grantedBy: adminId, updatedAt: now, email: target.email, status, boundUserId },
        $setOnInsert: { createdAt: now },
        $push: { history: { at: now, by: adminId, reason, details } },
    }, { upsert: true, returnDocument: 'after' });
    if (!result) throw new Error('Назначение не сохранено');
    const priest = boundUserId ? await applyPriest(db, boundUserId, details, result) : null;
    if (boundUserId) await col.updateOne({ _id: target._id, updatedAt: now }, { $set: { appliedAt: now, boundAt: current?.boundAt ?? now } });
    return { grant: result, priest };
}
/** Never accept email from a profile field, POST body, or an unverified token. */
export async function activatePriestEmailGrant(db: Db, userId: string, email: unknown, emailVerified: unknown) {
    if (emailVerified !== true || typeof email !== 'string') return null;
    let normalized: string;
    try { normalized = normalizeGrantEmail(email); } catch { return null; }
    const col = db.collection<DirectGrantRecord>('commemoratorDirectGrants');
    const id = `email:${normalized}`;
    // Bind once. A recycled email cannot transfer an already bound grant to a
    // different Google account. A retry by the same account repairs a crash.
    let grant = await col.findOneAndUpdate({ _id: id, status: 'waiting-login', boundUserId: null },
        { $set: { status: 'binding', boundUserId: userId } }, { returnDocument: 'after' });
    grant ??= await col.findOne({ _id: id, boundUserId: userId, status: { $in: ['binding', 'bound'] } });
    if (!grant) return null;
    const existing = await db.collection('commemorators').findOne({ userId });
    if (existing && ((grant.status === 'bound' && grant.appliedAt && +grant.appliedAt >= +grant.updatedAt)
        || (existing.confirmedAt && +existing.confirmedAt > +grant.updatedAt))) return existing;
    const priest = await applyPriest(db, userId, grant.details, grant);
    await col.updateOne({ _id: id, boundUserId: userId }, { $set: { status: 'bound', boundAt: grant.boundAt ?? new Date(), appliedAt: grant.updatedAt } });
    return priest;
}

export async function revokePendingPriestGrant(db: Db, adminId: string, email: unknown) {
    const result = await db.collection<DirectGrantRecord>('commemoratorDirectGrants').updateOne({
        _id: `email:${normalizeGrantEmail(email)}`, status: 'waiting-login', boundUserId: null,
    }, { $set: { status: 'revoked', revokedBy: adminId, revokedAt: new Date() },
        $push: { history: { at: new Date(), by: adminId, reason: 'Отменено до входа' } } });
    if (!result.matchedCount) throw new DirectGrantError('Назначение уже привязано или отменено. Обновите список', 409);
}
