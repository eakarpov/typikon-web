import { checkDomain, claimsByStatus, type ClaimStatus } from "@/lib/pomyannik/commemorators";

export interface ClaimRow {
    userId: string;
    title: string;
    dioceseUrl: string;
    email: string;
    evidence: string | null;
    status: ClaimStatus;
    /** Код, который должен вернуться в ответном письме. Сверяет человек. */
    token: string;
    domainNote: string;
    domainMatch: string;
    letterSentAt: string | null;
    repliedAt: string | null;
    checkNote: string | null;
    createdAt: string;
    again: boolean;
    priorNote: string | null;
}

/** Всё, что нужно для решения, — одной выборкой: и ссылка, и почта, и код. */
export const getClaims = async (): Promise<ClaimRow[]> => {
    const claims = await claimsByStatus(["pending", "letter-sent", "verified"]);
    return claims.map(claim => {
        const domain = checkDomain(claim.dioceseUrl, claim.email);
        return {
            userId: claim.userId, title: claim.title, dioceseUrl: claim.dioceseUrl,
            email: claim.email, evidence: claim.evidence ?? null,
            status: claim.status, token: claim.token,
            domainNote: domain.note, domainMatch: domain.match,
            letterSentAt: claim.letterSentAt?.toISOString() ?? null,
            repliedAt: claim.repliedAt?.toISOString() ?? null,
            checkNote: claim.checkNote ?? null,
            createdAt: claim.createdAt.toISOString(),
            again: Boolean(claim.again), priorNote: claim.priorDecision?.note ?? null,
        };
    });
};
