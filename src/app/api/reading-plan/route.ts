import { PlanError } from '@/lib/readingPlan/core';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/authorize/sessions';
import { consume } from '@/lib/rateLimit';
import { changePlan, createPlan, deletePlan, planOptions, readPlan } from '@/lib/readingPlan/service';
import { reportError } from '@/lib/reportError';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
    const s = await getSession();
    if (!s)
        return new NextResponse(null, { status: 401 });
    try {
        return NextResponse.json(req.nextUrl.searchParams.has('options') ? await planOptions() : await readPlan(s.id), { headers: { 'Cache-Control': 'private, no-store' } });
    }
    catch (e) {
        reportError(e, { where: 'reading-plan#GET' });
        return NextResponse.json({ error: 'Не удалось загрузить план.' }, { status: 500 });
    }
}
async function write(req: NextRequest, method: string) {
    const s = await getSession();
    if (!s)
        return new NextResponse(null, { status: 401 });
    if (!consume(`reading-plan:${s.id}`, 30, 60).allowed)
        return new NextResponse(null, { status: 429 });
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== 'object' || Array.isArray(b))
        return new NextResponse(null, { status: 400 });
    try {
        if (method === 'POST')
            await createPlan(s.id, b);
        else if (method === 'PATCH')
            await changePlan(s.id, b);
        else {
            if (typeof b.id !== 'string')
                return new NextResponse(null, { status: 400 });
            await deletePlan(s.id, b.id);
        }
        return NextResponse.json(await readPlan(s.id));
    }
    catch (e) {
        const message = e instanceof PlanError ? e.message : '';
        if ((e as {
            code?: number;
        }).code === 11000)
            return NextResponse.json({ error: 'Сначала завершите или удалите текущий план.' }, { status: 409 });
        reportError(e, { where: 'reading-plan#write' });
        return NextResponse.json({ error: message || 'Не удалось изменить план.' }, { status: 400 });
    }
}
export const POST = (r: NextRequest) => write(r, 'POST');
export const PATCH = (r: NextRequest) => write(r, 'PATCH');
export const DELETE = (r: NextRequest) => write(r, 'DELETE');
