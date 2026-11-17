import { authorizeUser } from '@/lib/api/v2/user';
import { fail, respondPrivate } from '@/lib/api/v2/http';
import clientPromise from '@/lib/mongodb';
import { reportError } from '@/lib/reportError';
export const dynamic = 'force-dynamic';

import { checkDomain, claimOf, commemoratorOf, saveClaim } from '@/lib/pomyannik/commemorators';
import { consume } from '@/lib/rateLimit';
export async function POST(request: Request) {
    const access = await authorizeUser(request, 'pomyannik');
    if (access.denied) return access.denied;
    const rate = consume(`commemorator-claim:${access.userId}`, 5, 3600);
    if (!rate.allowed) return fail('rate_limited', 'Слишком часто; попробуйте позже', { 'Retry-After': String(rate.retryAfter) });
    try {
        if (await commemoratorOf(access.userId)) return fail('conflict', 'Доступ уже подтверждён');
        const current = await claimOf(access.userId);
        if (current && current.status !== 'rejected') return fail('conflict', 'Заявка уже рассматривается');
        const body = await request.json().catch(() => null);
        const title = String(body?.title ?? '').trim().slice(0, 120);
        const dioceseUrl = String(body?.dioceseUrl ?? '').trim().slice(0, 300);
        const email = String(body?.email ?? '').trim().toLowerCase().slice(0, 200);
        if (!title) return fail('bad_request', 'Назовите себя: сан и имя');
        const domain = checkDomain(dioceseUrl, email);
        if (domain.match === 'unknown') return fail('bad_request', domain.note);
        const claim = await saveClaim({ userId: access.userId, title, dioceseUrl, email,
            evidence: String(body?.evidence ?? '').trim().slice(0, 1000) || null });
        return respondPrivate({ claim: { title: claim.title, dioceseUrl: claim.dioceseUrl,
            email: claim.email, evidence: claim.evidence, status: claim.status, createdAt: claim.createdAt }, domain },
            { access, status: 201 });
    } catch (e) {
        reportError(e, { where: 'priest/claim', source: 'api' });
        return fail('internal', 'Не удалось подать заявку');
    }
}
