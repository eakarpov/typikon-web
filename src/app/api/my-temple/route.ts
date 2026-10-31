import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/authorize/sessions';
import { consume } from '@/lib/rateLimit';
import { reportError } from '@/lib/reportError';
import { MyTempleError, parseTempleChoice } from '@/lib/myTemple/core';
import { readAccountTemple, writeAccountTemple } from '@/lib/myTemple/service';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
function failure(e: unknown) {
    if (e instanceof MyTempleError) return NextResponse.json({ error: e.message }, { status: e.status, headers });
    reportError(e, { where: 'api/my-temple' });
    return NextResponse.json({ error: 'Не удалось загрузить или сохранить выбранный храм. Попробуйте ещё раз.' }, { status: 503, headers });
}
export async function GET() {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401, headers });
    try { return NextResponse.json({ ...await readAccountTemple(session.id), userId: session.id }, { headers }); } catch (e) { return failure(e); }
}
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) return new NextResponse(null, { status: 401, headers });
    if (!consume(`my-temple:${session.id}`, 30, 60).allowed) return NextResponse.json({ error: 'Слишком часто. Попробуйте через минуту.' }, { status: 429, headers });
    const body = await request.json().catch(() => null);
    if (body?.expectedUserId !== undefined && body.expectedUserId !== session.id)
        return NextResponse.json({ error: 'Вход изменился. Обновите страницу.' }, { status: 409, headers });
    const choice = parseTempleChoice(body);
    if (!choice) return NextResponse.json({ error: 'Проверьте выбранный храм.' }, { status: 400, headers });
    try { return NextResponse.json({ ...await writeAccountTemple(session.id, choice), userId: session.id }, { headers }); } catch (e) { return failure(e); }
}
