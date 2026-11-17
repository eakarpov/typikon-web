import { authorizeUser } from '@/lib/api/v2/user';
import { fail, respondPrivate } from '@/lib/api/v2/http';
import clientPromise from '@/lib/mongodb';
import { reportError } from '@/lib/reportError';
export const dynamic = 'force-dynamic';

import { claimOf, commemoratorOf } from '@/lib/pomyannik/commemorators';
import { queuePolicies } from '@/lib/pomyannik/priestQueue';
export async function GET(request: Request) {
    const access = await authorizeUser(request, 'pomyannik');
    if (access.denied) return access.denied;
    try {
        const [claim, priest] = await Promise.all([claimOf(access.userId), commemoratorOf(access.userId)]);
        const safeClaim = claim ? { title: claim.title, dioceseUrl: claim.dioceseUrl,
            email: claim.email, evidence: claim.evidence, status: claim.status,
            decisionNote: claim.decisionNote, createdAt: claim.createdAt } : null;
        const db = (await clientPromise).db('typikon-users');
        const services = priest ? await queuePolicies(db, access.userId) : [];
        return respondPrivate({ approved: !!priest, claim: safeClaim,
            priest: priest ? { title: priest.title, place: priest.place, rank: (priest as any).rank ?? null,
                name: (priest as any).name ?? null, diocese: (priest as any).diocese ?? null, dioceseUrl: priest.dioceseUrl, inviteCode: priest.inviteCode,
                donationDetails: (priest as any).donationDetails ?? null } : null,
            services,
        }, { access });
    } catch (e) {
        reportError(e, { where: 'priest/profile', source: 'api' });
        return fail('internal', 'Не удалось открыть профиль иерея');
    }
}
