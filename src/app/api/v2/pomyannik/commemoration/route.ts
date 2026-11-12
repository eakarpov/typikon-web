import { reportError } from '@/lib/reportError';
import { authorizeUser } from '@/lib/api/v2/user';
import { fail, preflight, respondPrivate } from '@/lib/api/v2/http';
import { getBookSettings, listPersons, setCommemorations } from '@/lib/pomyannik/service';
import { CommemorationError, commemorationGroups, COMMEMORATION_PLACES } from '@/lib/pomyannik/commemoration';
export const dynamic = 'force-dynamic';
export const OPTIONS = () => {const response=preflight();response.headers.set('Access-Control-Allow-Methods','GET, PUT, OPTIONS');return response;};
export async function GET(request:Request) {
    const access = await authorizeUser(request,'pomyannik'); if(access.denied) return access.denied;
    try {
        const [settings,persons] = await Promise.all([getBookSettings(access.userId),listPersons(access.userId)]);
        return respondPrivate({ settings:settings.commemorations, groups:commemorationGroups(persons), places:COMMEMORATION_PLACES },{access});
    } catch(e) {reportError(e,{where:'api/v2/pomyannik/commemoration#GET',source:'api'});return fail('internal','Не удалось загрузить настройки поминовения.');}
}
export async function PUT(request:Request) {
    const access = await authorizeUser(request,'pomyannik'); if(access.denied) return access.denied;
    const body = await request.json().catch(()=>null);
    try { return respondPrivate({settings:await setCommemorations(access.userId,body?.settings)},{access}); }
    catch(e) { if(e instanceof CommemorationError) return fail('bad_request',e.message); reportError(e,{where:'api/v2/pomyannik/commemoration#PUT',source:'api'});return fail('internal','Не удалось сохранить настройки поминовения.'); }
}
