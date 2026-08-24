import { ObjectId } from "mongodb";
import {
    allowanceFor,
    generateToken,
    hashToken,
    tokenPrefix,
    tokenState,
    type ApiToken,
} from "@/lib/api/v2/tokens";
import { forgetCachedTokens, tokensCollection } from "@/lib/api/v2/tokenStore";
import { usageToday } from "@/lib/api/v2/usage";

// Ключи, которые пользователь заводит себе сам.
//
// Ограничение на число живых ключей здесь не для порядка: суточная квота считается на
// ключ, и без этого предела любой желающий умножал бы свою квоту, просто выпуская
// новые ключи. Пять — это «рабочий, домашний, бот, приложение и ещё один», больше
// одному человеку не нужно, а кому нужно — тому выдаётся ключ с другим тарифом.
export const MAX_ACTIVE_TOKENS = 5;

export const MAX_NAME_LENGTH = 60;

export interface TokenView {
    id: string;
    name: string;
    prefix: string;
    tier: string;
    createdAt: string;
    lastUsedAt: string | null;
    expiresAt: string | null;
    revoked: boolean;
    limit: number;
    windowSeconds: number;
    perDay: number | null;
    scopes: string[];
    usedToday: number;
}

const view = async (token: ApiToken): Promise<TokenView> => {
    const allowance = allowanceFor(token);

    return {
        id: token._id.toHexString(),
        name: token.name,
        prefix: token.prefix,
        tier: token.tier,
        createdAt: token.createdAt.toISOString(),
        lastUsedAt: token.lastUsedAt ? token.lastUsedAt.toISOString() : null,
        expiresAt: token.expiresAt ? token.expiresAt.toISOString() : null,
        revoked: tokenState(token) !== "ok",
        limit: allowance.limit,
        windowSeconds: allowance.windowSeconds,
        perDay: allowance.perDay,
        scopes: [...allowance.scopes],
        usedToday: await usageToday(token._id),
    };
};

/** Ключи пользователя, отозванные не показываем — они ему уже ни о чём не говорят. */
export const listTokens = async (userId: string): Promise<TokenView[]> => {
    const tokens = await tokensCollection();
    const items = await tokens
        .find({ userId, revokedAt: { $in: [null, undefined] } })
        .sort({ createdAt: -1 })
        .toArray();

    return Promise.all(items.map(view));
};

export type IssueResult =
    | { ok: true; token: string; item: TokenView }
    | { ok: false; error: string };

export const issueToken = async (userId: string, rawName: string): Promise<IssueResult> => {
    const tokens = await tokensCollection();

    const active = await tokens.countDocuments({ userId, revokedAt: { $in: [null, undefined] } });
    if (active >= MAX_ACTIVE_TOKENS) {
        return { ok: false, error: `Больше ${MAX_ACTIVE_TOKENS} ключей одновременно не выдаётся. Отзовите ненужный.` };
    }

    const name = rawName.trim().slice(0, MAX_NAME_LENGTH) || "Ключ";
    const plain = generateToken();

    const doc: Omit<ApiToken, "_id"> = {
        hash: hashToken(plain),
        prefix: tokenPrefix(plain),
        name,
        userId,
        tier: "free",
        createdAt: new Date(),
        expiresAt: null,
        revokedAt: null,
    };

    const { insertedId } = await tokens.insertOne(doc as ApiToken);

    return { ok: true, token: plain, item: await view({ ...doc, _id: insertedId } as ApiToken) };
};

/**
 * Отзыв — пометка, а не удаление: по ней видно, что ключ был и когда перестал
 * действовать, и накопленный расход остаётся привязанным к существующей записи.
 */
export const revokeToken = async (userId: string, id: string): Promise<boolean> => {
    if (!ObjectId.isValid(id)) return false;

    const tokens = await tokensCollection();
    const result = await tokens.updateOne(
        { _id: new ObjectId(id), userId, revokedAt: { $in: [null, undefined] } },
        { $set: { revokedAt: new Date() } },
    );

    // Ключ проверяется через кэш на полминуты — после отзыва его надо забыть сразу.
    if (result.modifiedCount) forgetCachedTokens();

    return result.modifiedCount > 0;
};
