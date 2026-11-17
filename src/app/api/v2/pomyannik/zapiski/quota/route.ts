import clientPromise from '@/lib/mongodb';
import { authorizeUser } from '@/lib/api/v2/user';
import { fail, respondPrivate } from '@/lib/api/v2/http';
import { weeklyQuota } from '@/lib/pomyannik/weeklyQuota';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
    const access = await authorizeUser(request, 'pomyannik');
    if (access.denied) return access.denied;
    try { return respondPrivate(await weeklyQuota((await clientPromise).db('typikon-users'), access.userId), { access }); }
    catch { return fail('internal', 'Не удалось загрузить недельный лимит'); }
}
