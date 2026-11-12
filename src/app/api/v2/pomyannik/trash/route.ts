import { authorizeUser } from '@/lib/api/v2/user';
import { fail, preflight, respondPrivate } from '@/lib/api/v2/http';
import { reportError } from '@/lib/reportError';
import { listTrash, restoreDeletedPerson, TooManyPersonsError } from '@/lib/pomyannik/service';
import { pomyannikPerson } from '@/lib/api/v2/serialize';
export const dynamic = 'force-dynamic';
export const OPTIONS = () => {
    const r = preflight();
    r.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    return r;
};
export async function GET(request: Request) {
    const access = await authorizeUser(request, 'pomyannik');
    if (access.denied)
        return access.denied;
    try {
        return respondPrivate({ items: (await listTrash(access.userId)).map(p => ({ ...pomyannikPerson(p), deletedAt: p.deletedAt })) }, { access });
    }
    catch (e) {
        reportError(e, { where: 'api/v2/pomyannik/trash', source: 'api' });
        return fail('internal', 'Не удалось открыть корзину.');
    }
}
export async function POST(request: Request) {
    const access = await authorizeUser(request, 'pomyannik');
    if (access.denied)
        return access.denied;
    const body = await request.json().catch(() => null);
    if (typeof body?.id !== 'string')
        return fail('bad_request', 'Нет записи.');
    try {
        if (!await restoreDeletedPerson(access.userId, body.id))
            return fail('not_found', 'Запись в вашей корзине не найдена.');
        return respondPrivate({ restored: true }, { access });
    }
    catch (e) {
        if (e instanceof TooManyPersonsError)
            return fail('conflict', e.message);
        reportError(e, { where: 'api/v2/pomyannik/trash#POST', source: 'api' });
        return fail('internal', 'Не удалось восстановить запись.');
    }
}
