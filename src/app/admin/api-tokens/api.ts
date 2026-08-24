import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { allowanceFor, tokenState, type ApiToken, type Scope, type Tier } from "@/lib/api/v2/tokens";
import { dayKey } from "@/lib/api/v2/quota";
import { TOKENS_DB } from "@/lib/api/v2/tokens";

export interface AdminTokenView {
    id: string;
    name: string;
    prefix: string;
    tier: Tier;
    /** Кто завёл ключ; null — выдан администратором, отвечает договорённость. */
    owner: { id: string; label: string } | null;
    limit: number;
    windowSeconds: number;
    perDay: number | null;
    scopes: Scope[];
    usedToday: number;
    createdAt: string;
    lastUsedAt: string | null;
    expiresAt: string | null;
    state: "ok" | "revoked" | "expired";
}

const ownerLabel = (user: any): string => {
    const name = [user?.name, user?.surname].filter(Boolean).join(" ").trim();
    return name || user?.email || user?._id?.toString() || "без имени";
};

/**
 * Все ключи для админки. Расход берётся из базы, а не из памяти процесса: в памяти он
 * точнее, но админка и публичный API — разные сборки, общей памяти у них может не быть.
 * Отставание — до полуминуты, на столько же отложен сброс расхода.
 */
export const getItems = async (): Promise<[AdminTokenView[] | null, any]> => {
    try {
        const db = (await clientPromise).db(TOKENS_DB);

        const tokens = await db.collection<ApiToken>("apiTokens")
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        const ids = tokens.map((token) => token._id);
        const ownerIds = [...new Set(tokens.map((token) => token.userId).filter(Boolean))] as string[];

        const [usage, owners] = await Promise.all([
            db.collection("apiTokenUsage").find({ tokenId: { $in: ids }, day: dayKey() }).toArray(),
            ownerIds.length
                ? db.collection("users").find({ _id: { $in: ownerIds.map((id) => new ObjectId(id)) } }).toArray()
                : Promise.resolve([]),
        ]);

        const usedBy = new Map(usage.map((doc) => [doc.tokenId.toString(), doc.count as number]));
        const ownerBy = new Map(owners.map((user) => [user._id.toString(), ownerLabel(user)]));

        return [tokens.map((token) => {
            const allowance = allowanceFor(token);

            return {
                id: token._id.toString(),
                name: token.name,
                prefix: token.prefix,
                tier: token.tier,
                owner: token.userId ? { id: token.userId, label: ownerBy.get(token.userId) ?? token.userId } : null,
                limit: allowance.limit,
                windowSeconds: allowance.windowSeconds,
                perDay: allowance.perDay,
                scopes: [...allowance.scopes],
                usedToday: usedBy.get(token._id.toString()) ?? 0,
                createdAt: token.createdAt.toISOString(),
                lastUsedAt: token.lastUsedAt ? token.lastUsedAt.toISOString() : null,
                expiresAt: token.expiresAt ? token.expiresAt.toISOString() : null,
                state: tokenState(token),
            };
        }), null];
    } catch (e) {
        console.error(e);
        return [null, { error: e }];
    }
};
