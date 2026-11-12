import { NextResponse } from 'next/server';
import { getSession } from '@/lib/authorize/sessions';
import { addPersonsToGroup } from '@/lib/pomyannik/groupsService';
import { GroupError } from '@/lib/pomyannik/groups';
import { reportError } from '@/lib/reportError';
export async function POST(request: Request) {
    const headers = { 'Cache-Control': 'private, no-store' }, session = await getSession();
    if (!session)
        return new NextResponse(null, { status: 401, headers });
    const body = await request.json().catch(() => null);
    try {
        return NextResponse.json(await addPersonsToGroup(session.id, body?.groupId, body?.personIds), { headers });
    }
    catch (e) {
        if (e instanceof GroupError)
            return NextResponse.json({ error: e.message }, { status: 400, headers });
        reportError(e, { where: 'api/pomyannik/groups/members', source: 'api' });
        return NextResponse.json({ error: 'Не удалось добавить имена в группу.' }, { status: 500, headers });
    }
}
