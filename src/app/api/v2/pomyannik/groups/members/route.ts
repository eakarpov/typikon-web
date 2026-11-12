import { authorizeUser } from '@/lib/api/v2/user';
import { fail, preflight, respondPrivate } from '@/lib/api/v2/http';
import { addPersonsToGroup } from '@/lib/pomyannik/groupsService';
import { GroupError } from '@/lib/pomyannik/groups';
import { reportError } from '@/lib/reportError';
export const OPTIONS = () => {
    const r = preflight();
    r.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    return r;
};
export async function POST(request: Request) {
    const access = await authorizeUser(request, 'pomyannik');
    if (access.denied)
        return access.denied;
    const body = await request.json().catch(() => null);
    try {
        return respondPrivate(await addPersonsToGroup(access.userId, body?.groupId, body?.personIds), { access });
    }
    catch (e) {
        if (e instanceof GroupError)
            return fail('bad_request', e.message);
        reportError(e, { where: 'api/v2/pomyannik/groups/members', source: 'api' });
        return fail('internal', 'Не удалось добавить имена в группу.');
    }
}
