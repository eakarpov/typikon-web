import { authorizeUser } from '@/lib/api/v2/user';
import { fail, preflight, respondPrivate } from '@/lib/api/v2/http';
import { createGroup, listGroups, reorderGroups, deleteGroup } from '@/lib/pomyannik/groupsService';
import { GroupError } from '@/lib/pomyannik/groups';
import { reportError } from '@/lib/reportError';
export const dynamic = 'force-dynamic';
export const OPTIONS = () => {
    const r = preflight();
    r.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    return r;
};
export async function GET(request: Request) {
    const access = await authorizeUser(request, 'pomyannik');
    if (access.denied)
        return access.denied;
    return respondPrivate({ groups: await listGroups(access.userId) }, { access });
}
export async function POST(request: Request) {
    const access = await authorizeUser(request, 'pomyannik');
    if (access.denied)
        return access.denied;
    const body = await request.json().catch(() => null);
    try {
        return respondPrivate({ group: await createGroup(access.userId, body?.name) }, { access, status: 201 });
    }
    catch (e) {
        if (e instanceof GroupError)
            return fail('bad_request', e.message);
        reportError(e, { where: 'api/v2/pomyannik/groups', source: 'api' });
        return fail('internal', 'Не удалось создать группу.');
    }
}

export async function PUT(request:Request) {
    const access=await authorizeUser(request,'pomyannik');
    if(access.denied)return access.denied;
    const body=await request.json().catch(()=>null);
    try {
        await reorderGroups(access.userId,body?.ids);
        return respondPrivate({saved:true,groups:await listGroups(access.userId)},{access});
    } catch(error) {
        if(error instanceof GroupError)return fail('conflict',error.message);
        reportError(error,{where:'api/v2/pomyannik/groups#PUT',source:'api'});
        return fail('internal','Не удалось сохранить порядок групп.');
    }
}

export async function DELETE(request:Request) {
    const access=await authorizeUser(request,'pomyannik');if(access.denied)return access.denied;
    const body=await request.json().catch(()=>null);
    try {return respondPrivate({deleted:true,...await deleteGroup(access.userId,body?.id,body?.deletePersons)},{access});}
    catch(error) {
        if(error instanceof GroupError)return fail('bad_request',error.message);
        reportError(error,{where:'api/v2/pomyannik/groups#DELETE',source:'api'});
        return fail('internal','Не удалось удалить группу. Повторите запрос.');
    }
}
