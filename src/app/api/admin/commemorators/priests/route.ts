import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { viewer } from '@/lib/rights-server';
import { listPriests, updatePriestIdentity } from '@/lib/pomyannik/priestAdmin';
import { DirectGrantError } from '@/lib/pomyannik/directGrantRules';
import { consume } from '@/lib/rateLimit';
import { reportError } from '@/lib/reportError';
export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => NextResponse.json(body, {status, headers:{'Cache-Control':'private, no-store'}});
const allowed = (a: Awaited<ReturnType<typeof viewer>>) => a.userId && (a.caps.has('commemoration.claims') || a.caps.has('commemoration.grant'));
export async function GET(request: Request) {
    const actor = await viewer();
    if (!allowed(actor)) return reply({error:'Недостаточно прав'}, actor.userId ? 403 : 401);
    try {
        const params = new URL(request.url).searchParams;
        const integer = (key: string, fallback: number, min: number, max: number) => {
            const n = Number(params.get(key) ?? fallback);
            return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
        };
        return reply(await listPriests((await clientPromise).db('typikon-users'), (params.get('q') ?? '').trim().slice(0,200), integer('offset',0,0,100000), integer('limit',50,1,100)));
    } catch(e) { reportError(e,{where:'admin/commemorators/priests#GET',source:'api'}); return reply({error:'Не удалось загрузить список иереев'},500); }
}
export async function PUT(request: Request) {
    const actor = await viewer();
    if (!allowed(actor)) return reply({error:'Недостаточно прав'}, actor.userId ? 403 : 401);
    if (!consume(`priest-identity:${actor.userId}`,30,3600).allowed) return reply({error:'Слишком часто. Попробуйте позже'},429);
    try {
        return reply({priest:await updatePriestIdentity((await clientPromise).db('typikon-users'), actor.userId!, await request.json().catch(()=>null))});
    } catch(e) {
        if (e instanceof DirectGrantError) return reply({error:e.message},e.status);
        reportError(e,{where:'admin/commemorators/priests#PUT',source:'api'}); return reply({error:'Не удалось сохранить данные иерея'},500);
    }
}
