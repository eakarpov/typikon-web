import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { claimsByStatus } from "@/lib/parish/claims";
import type { ClaimRow } from "./Content";

// Всё, что нужно для решения, — одной выборкой: сам храм, его контакты и кто
// заявитель. Модератору незачем ходить по трём разделам, чтобы позвонить.
export const getClaims = async (): Promise<ClaimRow[]> => {
    const claims = await claimsByStatus(["pending", "verified"]);
    if (!claims.length) return [];
    const client = await clientPromise;
    const temples = client.db("typikon").collection("temples");
    const users = client.db("typikon-users").collection("users");

    const byTemple = new Map((await temples.find(
        { slug: { $in: claims.map(c => c.templeSlug) } },
        { projection: { slug: 1, name: 1, place: 1, website: 1, phone: 1 } },
    ).toArray()).map(t => [t.slug as string, t]));

    const ids = claims.map(c => { try { return new ObjectId(c.userId); } catch { return null; } })
        .filter(Boolean) as ObjectId[];
    const byUser = new Map((await users.find({ _id: { $in: ids } },
        { projection: { email: 1 } }).toArray()).map(u => [String(u._id), u]));

    return claims.map(c => {
        const t = byTemple.get(c.templeSlug);
        return {
            id: c._id!, templeSlug: c.templeSlug,
            templeName: (t?.name as string) ?? c.templeSlug,
            templePlace: (t?.place as string) ?? null,
            website: (t?.website as string) ?? null,
            phone: (t?.phone as string) ?? null,
            userId: c.userId, userEmail: (byUser.get(c.userId)?.email as string) ?? null,
            role: c.role, contact: c.contact, evidence: c.evidence ?? null,
            status: c.status, method: c.method, checkNote: c.checkNote ?? null,
            createdAt: c.createdAt.toISOString(),
            again: Boolean(c.again), priorNote: c.priorDecision?.note ?? null,
        };
    });
};
