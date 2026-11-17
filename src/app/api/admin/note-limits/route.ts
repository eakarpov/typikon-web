import { NextResponse } from 'next/server';
import { viewer } from '@/lib/rights-server';
import clientPromise from '@/lib/mongodb';
import { weeklyPolicy, saveWeeklyPolicy } from '@/lib/pomyannik/weeklyQuota';
import { NoteError } from '@/lib/pomyannik/note';
export const dynamic = 'force-dynamic';
export async function PUT(request: Request) {
    const { userId, caps } = await viewer();
    if (!userId || !caps.has('commemoration.claims'))
        return NextResponse.json({ error: 'Нет доступа' }, { status: userId ? 403 : 401 });
    try { return NextResponse.json(await saveWeeklyPolicy((await clientPromise).db('typikon-users'), await request.json(), userId), {headers:{'Cache-Control':'private, no-store'}}); }
    catch (e) { return NextResponse.json({ error: e instanceof NoteError ? e.message : 'Не удалось сохранить настройки' }, { status: e instanceof NoteError ? 400 : 500 }); }
}
export async function GET() {
    const { userId, caps } = await viewer();
    if (!userId || !caps.has('commemoration.claims'))
        return NextResponse.json({ error: 'Нет доступа' }, { status: userId ? 403 : 401 });
    return NextResponse.json(await weeklyPolicy((await clientPromise).db('typikon-users')), {headers:{'Cache-Control':'private, no-store'}});
}
