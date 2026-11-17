import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { viewer } from '@/lib/rights-server';
import { DirectGrantError, grantPriestDirectly, revokePendingPriestGrant } from '@/lib/pomyannik/directGrant';
import { reportError } from '@/lib/reportError';
import { consume } from '@/lib/rateLimit';
export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request: Request) {
    const actor = await viewer();
    if (!actor.userId || !actor.caps.has('commemoration.grant')) return reply({ error: 'Недостаточно прав' }, actor.userId ? 403 : 401);
    const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 254);
    try {
        const db = (await clientPromise).db('typikon-users');
        const grants = await db.collection('commemoratorDirectGrants').find({ status: 'waiting-login' },
            { projection: { email: 1, details: 1, reason: 1, updatedAt: 1 } }).sort({ updatedAt: -1 }).limit(50).toArray();
        if (q.length < 2) return reply({ users: [], grants });
        const regex = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const filters: any[] = [{ name: { $regex: regex, $options: 'i' } }, { surname: { $regex: regex, $options: 'i' } },
            { email: { $regex: `^${regex}$`, $options: 'i' } }, { 'auth.google.verifiedEmail': q.toLowerCase() }];
        if (/^[a-f0-9]{24}$/i.test(q)) filters.push({ _id: new ObjectId(q) });
        const users = await db.collection('users').find({ $or: filters }, { projection: { name: 1, surname: 1, email: 1 } }).limit(10).toArray();
        const priests = await db.collection('commemorators').find({ userId: { $in: users.map(u => String(u._id)) } }).toArray();
        return reply({ users: users.map(u => { const p = priests.find(p => p.userId === String(u._id)); return {
            id: String(u._id), name: [u.name, u.surname].filter(Boolean).join(' '), email: u.email ?? '',
            priest: p ? { title: p.title, rank: p.rank ?? '', name: p.name ?? '', diocese: p.diocese ?? '',
                dioceseUrl: p.dioceseUrl ?? '', place: p.place ?? '', about: p.about ?? '', donationDetails: p.donationDetails ?? '' } : null,
        }; }), grants });
    } catch (e) { reportError(e, { where: 'admin/commemorators/direct#GET', source: 'api' }); return reply({ error: 'Не удалось найти аккаунт' }, 500); }
}
export async function POST(request: Request) {
    const actor = await viewer();
    if (!actor.userId || !actor.caps.has('commemoration.grant')) return reply({ error: 'Недостаточно прав' }, actor.userId ? 403 : 401);
    const rate = consume(`direct-priest:${actor.userId}`, 30, 3600);
    if (!rate.allowed) return reply({ error: 'Слишком часто. Попробуйте позже' }, 429);
    try {
        const body = await request.json().catch(() => null);
        const db = (await clientPromise).db('typikon-users');
        if (body?.action === 'revoke-pending') { await revokePendingPriestGrant(db, actor.userId, body.email); return reply({ ok: true }); }
        const { grant, priest } = await grantPriestDirectly(db, actor.userId, body);
        return reply({ ok: true, status: grant.status, title: grant.details.title, email: grant.email,
            userId: grant.boundUserId, priest: priest ? { title: priest.title } : null });
    } catch (e) {
        if (e instanceof DirectGrantError) return reply({ error: e.message }, e.status);
        reportError(e, { where: 'admin/commemorators/direct#POST', source: 'api' }); return reply({ error: 'Не удалось назначить доступ' }, 500);
    }
}
