import { authorizeUser } from '@/lib/api/v2/user';
import { fail, preflight, respondPrivate } from '@/lib/api/v2/http';
import { reportError } from '@/lib/reportError';
import { restorePersons, TooManyPersonsError } from '@/lib/pomyannik/service';
import { BackupError, MAX_BACKUP_BYTES } from '@/lib/pomyannik/backup';
export const dynamic = 'force-dynamic';
export const OPTIONS = () => {
    const r = preflight();
    r.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    return r;
};
export async function POST(request: Request) {
    const access = await authorizeUser(request, 'pomyannik');
    if (access.denied)
        return access.denied;
    if (Number(request.headers.get('content-length')) > MAX_BACKUP_BYTES)
        return fail('bad_request', 'Файл больше 64 МБ.');
    const reader = request.body?.getReader();
    if (!reader)
        return fail('bad_request', 'Нет файла.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
        const { value, done } = await reader.read();
        if (done)
            break;
        size += value.byteLength;
        if (size > MAX_BACKUP_BYTES) {
            await reader.cancel();
            return fail('bad_request', 'Файл больше 64 МБ.');
        }
        chunks.push(value);
    }
    try {
        return respondPrivate(await restorePersons(access.userId, JSON.parse(Buffer.concat(chunks).toString('utf8'))), { access });
    }
    catch (e) {
        if (e instanceof BackupError || e instanceof TooManyPersonsError || e instanceof SyntaxError)
            return fail('bad_request', e.message);
        reportError(e, { where: 'api/v2/pomyannik/restore', source: 'api' });
        return fail('internal', 'Не удалось восстановить файл.');
    }
}
