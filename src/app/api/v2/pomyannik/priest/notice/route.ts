import { authorizeUser } from '@/lib/api/v2/user';
import { fail, respondPrivate } from '@/lib/api/v2/http';
import clientPromise from '@/lib/mongodb';
import { commemoratorOf } from '@/lib/pomyannik/commemorators';
import { slotsOf } from '@/lib/pomyannik/priestQueue';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
    const access = await authorizeUser(request, 'pomyannik');
    if (access.denied) return access.denied;
    if (!await commemoratorOf(access.userId)) return fail('forbidden', 'Доступ иерея не подтверждён');
    const id = new URL(request.url).searchParams.get('serviceId') ?? '';
    const s = await slotsOf((await clientPromise).db('typikon-users')).findOne({ _id: id, userId: access.userId, active: true });
    const now = new Date();
    const show = s?.status !== 'reading' && !!s?.reminderEnabled && !!s.startsAt && s.startsAt > now
        && +s.startsAt - +now <= 3600000 && s.entries.some(e => !e.readAt);
    return respondPrivate({ show, serviceId: id, userId: access.userId, startsAt: show ? s?.startsAt : null }, { access });
}
