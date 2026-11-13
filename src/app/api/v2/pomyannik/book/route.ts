import { listGroups } from "@/lib/pomyannik/groupsService";
import { authorizeUser } from '@/lib/api/v2/user';
import { fail, preflight, respondPrivate } from '@/lib/api/v2/http';
import { reportError } from '@/lib/reportError';
import { listPersons, getBookSettings, setBookSettings, setReadingPlace, reorderPersons } from '@/lib/pomyannik/service';
import { pomyannikPerson } from '@/lib/api/v2/serialize';
import { personSlavonic } from '@/lib/pomyannik/slavonic';
import { cleanReadingPlace } from '@/lib/pomyannik/reader';
export const dynamic = 'force-dynamic';
export const OPTIONS = () => {
    const r = preflight();
    r.headers.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    return r;
};
export async function GET(request: Request) {
    const access = await authorizeUser(request, 'pomyannik');
    if (access.denied)
        return access.denied;
    try {
        const [persons, settings] = await Promise.all([listPersons(access.userId), getBookSettings(access.userId)]);
        const forms = await Promise.all(persons.map(personSlavonic));
        return respondPrivate({ groups:await listGroups(access.userId), items: persons.map((p, index) => ({ ...pomyannikPerson(p), slavonic: forms[index] })), settings }, { access });
    }
    catch (e) {
        reportError(e, { where: 'api/v2/pomyannik/book', source: 'api' });
        return fail('internal', 'Не удалось открыть помянник.');
    }
}
export async function PUT(request: Request) {
    const access = await authorizeUser(request, 'pomyannik');
    if (access.denied)
        return access.denied;
    const body = await request.json().catch(() => null);
    if (!body)
        return fail('bad_request', 'Нет настроек.');
    try {
        if (body.action === 'signatures' && typeof body.value === 'boolean')
            await setBookSettings(access.userId, body.value);
        else if (body.action === 'reading') {
            const place = cleanReadingPlace(body.place);
            if (body.place !== null && !place)
                return fail('bad_request', 'Некорректная закладка.');
            if (!await setReadingPlace(access.userId, place))
                return fail('not_found', 'Имя больше не найдено.');
        }
        else if (body.action === 'order') {
            if (!await reorderPersons(access.userId, body.ids))
                return fail('conflict', 'Список изменился. Обновите помянник.');
        }
        else
            return fail('bad_request', 'Неизвестное действие.');
        return respondPrivate({ saved: true }, { access });
    }
    catch (e) {
        reportError(e, { where: 'api/v2/pomyannik/book#PUT', source: 'api' });
        return fail('internal', 'Не удалось сохранить настройку.');
    }
}
