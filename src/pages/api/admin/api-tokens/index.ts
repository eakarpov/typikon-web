import { NextApiRequest, NextApiResponse } from "next";
import { checkRightsBack } from "@/lib/admin/back";
import {
    SCOPES,
    TIERS,
    allowanceFor,
    generateToken,
    hashToken,
    tokenPrefix,
    type ApiToken,
    type Scope,
    type Tier,
} from "@/lib/api/v2/tokens";
import { forgetCachedTokens, tokensCollection } from "@/lib/api/v2/tokenStore";

// Выпуск ключа администратором. От самовыпуска в профиле отличается тем, что здесь
// можно задать тариф и любые частные числа: так выдаются ключи приложению и партнёрам.
// То же самое делает npm run api:token — страница просто избавляет от похода на сервер.

/** Разбор чисел из формы: пустое поле значит «оставить тарифное», а не «ноль». */
const optionalNumber = (value: unknown): number | undefined => {
    if (value === undefined || value === null || value === "") return undefined;

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Числа лимитов должны быть положительными");
    return parsed;
};

const optionalScopes = (value: unknown): Scope[] | undefined => {
    if (!Array.isArray(value) || !value.length) return undefined;

    const unknown = value.filter((scope) => !SCOPES.includes(scope));
    if (unknown.length) throw new Error(`Неизвестные разделы: ${unknown.join(", ")}`);

    return value as Scope[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!process.env.SHOW_ADMIN) {
        res.status(404).end();
        return;
    }
    if (req.method !== "POST") {
        res.status(404).end();
        return;
    }
    if (!(await checkRightsBack(req, res))) return;

    try {
        const { name, tier = "partner", days, ...rest } = req.body ?? {};

        if (!name || typeof name !== "string" || !name.trim()) {
            res.status(400).json({ error: "Название обязательно: по нему ключ потом узнают в списке" });
            return;
        }
        if (!TIERS[tier as Tier]) {
            res.status(400).json({ error: `Неизвестный тариф: ${tier}` });
            return;
        }

        const expiresDays = optionalNumber(days);
        const doc = {
            name: name.trim().slice(0, 60),
            // Ключ выдан администратором и владельца среди пользователей не имеет:
            // за него отвечает договорённость, а не учётная запись на сайте.
            userId: null,
            tier: tier as Tier,
            createdAt: new Date(),
            expiresAt: expiresDays ? new Date(Date.now() + expiresDays * 86400_000) : null,
            revokedAt: null,
            ...(optionalNumber(rest.limit) ? { limit: optionalNumber(rest.limit) } : {}),
            ...(optionalNumber(rest.windowSeconds) ? { windowSeconds: optionalNumber(rest.windowSeconds) } : {}),
            // «none» — осознанное «без суточного потолка», его надо отличать от «не задано».
            ...(rest.perDay === "none" ? { perDay: null } : optionalNumber(rest.perDay) ? { perDay: optionalNumber(rest.perDay) } : {}),
            ...(optionalScopes(rest.scopes) ? { scopes: optionalScopes(rest.scopes) } : {}),
        };

        const plain = generateToken();
        const tokens = await tokensCollection();
        const { insertedId } = await tokens.insertOne({
            ...doc,
            hash: hashToken(plain),
            prefix: tokenPrefix(plain),
        } as ApiToken);

        forgetCachedTokens();

        // Открытый ключ уходит один раз и только здесь: в базе лежит лишь его хэш.
        res.status(200).json({
            token: plain,
            id: insertedId.toString(),
            allowance: allowanceFor(doc as ApiToken),
        });
    } catch (e) {
        console.error("admin api-tokens", e);
        res.status(400).json({ error: e instanceof Error ? e.message : "Не удалось выпустить ключ" });
    }
}
