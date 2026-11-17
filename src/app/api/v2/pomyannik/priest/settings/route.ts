import { authorizeUser } from '@/lib/api/v2/user';
import { fail, respondPrivate } from '@/lib/api/v2/http';
import clientPromise from '@/lib/mongodb';
import { reportError } from '@/lib/reportError';
export const dynamic = 'force-dynamic';

import { commemoratorOf } from '@/lib/pomyannik/commemorators';
import { saveQueueSettings } from '@/lib/pomyannik/priestQueue';
import { QueueError } from '@/lib/pomyannik/priestQueueRules';
export async function PUT(request: Request) {
    const access = await authorizeUser(request, 'pomyannik');
    if (access.denied) return access.denied;
    try {
        if (!await commemoratorOf(access.userId)) return fail('forbidden', 'Доступ иерея пока не подтверждён');
        await saveQueueSettings((await clientPromise).db('typikon-users'), access.userId,
            await request.json().catch(() => null));
        return respondPrivate({ ok: true }, { access });
    } catch (e) {
        if (e instanceof QueueError) return fail(e.code, e.message);
        reportError(e, { where: 'priest/settings', source: 'api' });
        return fail('internal', 'Не удалось сохранить настройки. Обновите их перед повтором');
    }
}
