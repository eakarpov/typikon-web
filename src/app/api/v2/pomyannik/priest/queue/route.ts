import { authorizeUser } from '@/lib/api/v2/user';
import { fail, respondPrivate } from '@/lib/api/v2/http';
import clientPromise from '@/lib/mongodb';
import { reportError } from '@/lib/reportError';
export const dynamic = 'force-dynamic';

import { commemoratorOf } from '@/lib/pomyannik/commemorators';
import { slotsOf, queueNotes, waitingFor, takeExtra, markQueued, createService, startService, finishService, expireServices, editService, deleteService, advanceReadingPhase } from '@/lib/pomyannik/priestQueue';
import { READING_PHASES, noteCounts } from '@/lib/pomyannik/priestReadingParts';
import { QueueError } from '@/lib/pomyannik/priestQueueRules';
import { zapiska } from '@/lib/api/v2/serialize';
export async function GET(request: Request) {
    const access = await authorizeUser(request, 'pomyannik');
    if (access.denied) return access.denied;
    try {
        if (!await commemoratorOf(access.userId)) return fail('forbidden', 'Доступ иерея пока не подтверждён');
        const db = (await clientPromise).db('typikon-users');
        await expireServices(db);
        const params = new URL(request.url).searchParams;
        const archive = params.get('archive') === 'true';
        const split = params.get('flow') === 'two-stage';
        const slots = await slotsOf(db).find({ userId: access.userId, active: !archive, startsAt: { $ne: null } }).sort({ startsAt: 1 }).toArray();
        const waitingByKind = new Map<string, Promise<any[]>>();
        const pending = (kind: string) => {
            if (!waitingByKind.has(kind)) waitingByKind.set(kind, waitingFor(db, access.userId, kind));
            return waitingByKind.get(kind)!;
        };
        const services = await Promise.all(slots.map(async s => {
            const [notes, waiting] = await Promise.all([queueNotes(db, s, split && (s.flowVersion===2 || s.status!=='reading')), s.active ? pending(s.kind) : Promise.resolve([])]);
            return { id: s._id, kind: s.kind, startsAt: s.startsAt, timeZone: s.timeZone,
                flowVersion: s.flowVersion ?? 1, readingPhase: s.readingPhase ?? null, readingMode: s.readingMode ?? 'batch',
                waitingByPhase: Object.fromEntries(READING_PHASES.map(part => {const eligible=waiting.filter(n=>noteCounts(n)[part]);return [part,{notes:eligible.length,names:eligible.reduce((sum,n)=>sum+(noteCounts(n)[part]??0),0)}];})),
                status: s.status ?? (s.active ? 'scheduled' : 'finished'), startedAt: s.startedAt, expiresAt: s.expiresAt, finishedAt: s.finishedAt,
                enabled: s.enabled, namesLimit: s.namesLimit, readyAt: s.readyAt, editableUntil: s.editableUntil,
                acceptedNames: s.entries.reduce((n, e) => n + e.namesCount, 0),
                items: notes.map(n => ({ ...zapiska(n), extra: (n as any).extra })),
                waitingNotes: waiting.length, waitingNames: waiting.reduce((n, e) => n + e.namesCount, 0) };
        }));
        return respondPrivate({ services }, { access });
    } catch (e) {
        reportError(e, { where: 'priest/queue', source: 'api' });
        return fail('internal', 'Не удалось открыть очередь');
    }
}
export async function POST(request: Request) {
    const access = await authorizeUser(request, 'pomyannik');
    if (access.denied) return access.denied;
    try {
        if (!await commemoratorOf(access.userId)) return fail('forbidden', 'Доступ иерея пока не подтверждён');
        const db = (await clientPromise).db('typikon-users');
        const body = await request.json().catch(() => null);
        if (body?.action === 'create') {
            const serviceId = await createService(db, access.userId, body);
            return respondPrivate({ serviceId }, { access });
        }
        if (body?.action === 'delete') {
            await deleteService(db, access.userId, String(body.serviceId ?? ''));
            return respondPrivate({ ok: true }, { access });
        }
        if (body?.action === 'edit') {
            await editService(db, access.userId, String(body.serviceId ?? ''), body);
            return respondPrivate({ ok: true }, { access });
        }
        if (body?.action === 'start') {
            await startService(db, access.userId, String(body.serviceId ?? ''), new Date(), body.twoStage === true);
            return respondPrivate({ ok: true }, { access });
        }
        if (body?.action === 'advance') {
            await advanceReadingPhase(db, access.userId, String(body.serviceId ?? ''));
            return respondPrivate({ok:true},{access});
        }
        if (body?.action === 'finish') {
            await finishService(db, access.userId, String(body.serviceId ?? ''));
            return respondPrivate({ ok: true }, { access });
        }
        if (body?.action === 'extra') {
            const noteId = await takeExtra(db, access.userId, String(body.serviceId ?? ''));
            return respondPrivate({ noteId }, { access });
        }
        if (body?.action === 'read') {
            const id = String(body.noteId ?? '');
            if (!await markQueued(db, access.userId, id, new Date(), body.part)) return fail('not_found', 'Записка не найдена');
            return respondPrivate({ ok: true }, { access });
        }
        return fail('bad_request', 'Неизвестное действие');
    } catch (e) {
        if (e instanceof QueueError) return fail(e.code, e.message);
        reportError(e, { where: 'priest/queue', source: 'api' });
        return fail('internal', 'Не удалось обновить очередь');
    }
}
