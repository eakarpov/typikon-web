import { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import { checkRightsBack } from "@/lib/admin/back";
import { SCOPES, TIERS, type ApiToken, type Scope, type Tier } from "@/lib/api/v2/tokens";
import { forgetCachedTokens, tokensCollection } from "@/lib/api/v2/tokenStore";

// Правка живого ключа: лимиты, разделы, тариф, отзыв и возврат.
//
// Поля перечислены явно, а не приняты телом целиком: тело приходит из браузера, и
// $set: {...req.body} позволил бы переписать hash и завладеть чужим ключом.

const patchFrom = (body: any): Partial<ApiToken> => {
    const patch: Partial<ApiToken> = {};

    if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 60);

    if (body.tier !== undefined) {
        if (!TIERS[body.tier as Tier]) throw new Error(`Неизвестный тариф: ${body.tier}`);
        patch.tier = body.tier as Tier;
    }

    for (const field of ["limit", "windowSeconds"] as const) {
        if (body[field] === undefined || body[field] === "") continue;

        const value = Number(body[field]);
        if (!Number.isFinite(value) || value <= 0) throw new Error("Лимиты должны быть положительными числами");
        patch[field] = value;
    }

    if (body.perDay !== undefined && body.perDay !== "") {
        if (body.perDay === "none") {
            patch.perDay = null;
        } else {
            const value = Number(body.perDay);
            if (!Number.isFinite(value) || value <= 0) throw new Error("Суточная квота должна быть положительной");
            patch.perDay = value;
        }
    }

    if (Array.isArray(body.scopes)) {
        if (!body.scopes.length) throw new Error("Хотя бы один раздел должен остаться");

        const unknown = body.scopes.filter((scope: string) => !SCOPES.includes(scope as Scope));
        if (unknown.length) throw new Error(`Неизвестные разделы: ${unknown.join(", ")}`);

        patch.scopes = body.scopes as Scope[];
    }

    // Возврат отозванного нужен на случай промаха: ключ гасится одним нажатием,
    // а восстановить его иначе нельзя — открытого значения у нас нет.
    if (body.revoked === true) patch.revokedAt = new Date();
    if (body.revoked === false) patch.revokedAt = null;

    return patch;
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

    const id = req.query.id as string;
    if (!ObjectId.isValid(id)) {
        res.status(400).json({ error: "Неверный идентификатор ключа" });
        return;
    }

    try {
        const patch = patchFrom(req.body ?? {});
        if (!Object.keys(patch).length) {
            res.status(400).json({ error: "Нечего менять" });
            return;
        }

        const tokens = await tokensCollection();
        const result = await tokens.updateOne({ _id: new ObjectId(id) }, { $set: patch });

        if (!result.matchedCount) {
            res.status(404).json({ error: "Ключ не найден" });
            return;
        }

        forgetCachedTokens();
        res.status(200).json({ ok: true });
    } catch (e) {
        console.error("admin api-tokens patch", e);
        res.status(400).json({ error: e instanceof Error ? e.message : "Не удалось изменить ключ" });
    }
}
