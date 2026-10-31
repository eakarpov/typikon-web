import { authorizeUser } from '@/lib/api/v2/user';
import { respondPrivate, fail } from '@/lib/api/v2/http';
import { mobileReadingPlan } from '@/lib/readingPlan/mobile';
import { changePlan } from '@/lib/readingPlan/service';
import { PlanError } from '@/lib/readingPlan/core';
import { reportError } from '@/lib/reportError';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) { const a = await authorizeUser(req, 'texts'); if (a.denied)
    return a.denied; try {
    return respondPrivate(await mobileReadingPlan(a.userId), { access: a });
}
catch (e) {
    reportError(e, { where: 'reading-plan/v2' });
    return fail('internal', 'Не удалось загрузить личный план.');
} }
export async function PATCH(req: Request) { const a = await authorizeUser(req, 'texts'); if (a.denied)
    return a.denied; const b = await req.json().catch(() => null); if (!b || !['reminder', 'pause', 'resume', 'advance'].includes(b.action))
    return fail('bad_request', 'Неверное действие.'); try {
    await changePlan(a.userId, b);
    return respondPrivate(await mobileReadingPlan(a.userId), { access: a });
}
catch (e) {
    if (e instanceof PlanError)
        return fail('conflict', e.message);
    reportError(e, { where: 'reading-plan/v2/PATCH' });
    return fail('internal', 'Не удалось изменить план.');
} }
