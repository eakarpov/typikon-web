import { listGroups } from "@/lib/pomyannik/groupsService";
import { authorizeUser } from '@/lib/api/v2/user';
import { fail, preflight, respondPrivate } from '@/lib/api/v2/http';
import { reportError } from '@/lib/reportError';
import { listPersons } from '@/lib/pomyannik/service';
import { makeBackup } from '@/lib/pomyannik/backup';
export const dynamic = 'force-dynamic';
export const OPTIONS = () => preflight();
export async function GET(request: Request) {
    const access = await authorizeUser(request, 'pomyannik');
    if (access.denied)
        return access.denied;
    try {
        return respondPrivate(makeBackup(await listPersons(access.userId),new Date(),await listGroups(access.userId)), { access });
    }
    catch (e) {
        reportError(e, { where: 'api/v2/pomyannik/backup', source: 'api' });
        return fail('internal', 'Не удалось выгрузить помянник.');
    }
}
