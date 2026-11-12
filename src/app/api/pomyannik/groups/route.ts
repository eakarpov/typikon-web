import { NextResponse } from 'next/server';
import { getSession } from '@/lib/authorize/sessions';
import { createGroup, listGroups } from '@/lib/pomyannik/groupsService';
import { GroupError } from '@/lib/pomyannik/groups';
import { reportError } from '@/lib/reportError';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET() {
    const session = await getSession();
    if (!session)
        return new NextResponse(null, { status: 401, headers });
    return NextResponse.json({ groups: await listGroups(session.id) }, { headers });
}
export async function POST(request: Request) {
    const session = await getSession();
    if (!session)
        return new NextResponse(null, { status: 401, headers });
    const body = await request.json().catch(() => null);
    try {
        return NextResponse.json({ group: await createGroup(session.id, body?.name) }, { status: 201, headers });
    }
    catch (e) {
        if (e instanceof GroupError)
            return NextResponse.json({ error: e.message }, { status: 400, headers });
        reportError(e, { where: 'api/pomyannik/groups', source: 'api' });
        return NextResponse.json({ error: 'Не удалось создать группу.' }, { status: 500, headers });
    }
}
