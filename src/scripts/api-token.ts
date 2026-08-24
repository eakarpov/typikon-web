// Ключи API, выдаваемые не через профиль: свои приложения и договорённости с
// потребителями. Пользователь заводит себе ключ сам (профиль → «Ключи API»), но там
// выдаётся тариф free; ключ приложения с общей квотой на всех его пользователей и ключ
// партнёра с особыми числами выпускаются отсюда.
//
// Открытый ключ печатается один раз — в базе лежит только его sha256. Потеряли —
// отзывайте и выпускайте новый.
//
// Запуск (без --apply ничего не меняется):
//   npx tsx src/scripts/api-token.ts list
//   npx tsx src/scripts/api-token.ts issue --name "Android" --tier app --apply
//   npx tsx src/scripts/api-token.ts issue --name "Приход" --tier partner --per-day 50000 --days 365 --apply
//   npx tsx src/scripts/api-token.ts set --id <id> --per-day 50000 --apply
//   npx tsx src/scripts/api-token.ts revoke --id <id> --apply
import "@/scripts/lib/env";
import { ObjectId } from "mongodb";
import {
    ALL_SCOPES,
    SCOPES,
    TIERS,
    allowanceFor,
    generateToken,
    hashToken,
    tokenPrefix,
    tokenState,
    type ApiToken,
    type Scope,
    type Tier,
} from "@/lib/api/v2/tokens";
import { tokensCollection } from "@/lib/api/v2/tokenStore";
import { usageToday } from "@/lib/api/v2/usage";

const APPLY = process.argv.includes("--apply");
const [command] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

const option = (name: string): string | undefined => {
    const index = process.argv.indexOf(`--${name}`);
    return index === -1 ? undefined : process.argv[index + 1];
};

const number = (name: string): number | undefined => {
    const raw = option(name);
    if (raw === undefined) return undefined;

    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`--${name} должен быть положительным числом`);
    return value;
};

const readScopes = (): Scope[] | undefined => {
    const raw = option("scopes");
    if (!raw) return undefined;

    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const unknown = parts.filter((p) => !SCOPES.includes(p as Scope));
    if (unknown.length) throw new Error(`Неизвестные разделы: ${unknown.join(", ")}. Известны: ${ALL_SCOPES.join(", ")}`);

    return parts as Scope[];
};

const describe = async (token: ApiToken) => {
    const allowance = allowanceFor(token);
    const state = tokenState(token);
    const used = await usageToday(token._id);

    console.log(
        [
            token._id.toHexString(),
            token.prefix.padEnd(12),
            token.tier.padEnd(8),
            state === "ok" ? "  " : state === "revoked" ? "отозван" : "просрочен",
            `${allowance.limit}/${allowance.windowSeconds}с`,
            allowance.perDay === null ? "без суточной" : `${used}/${allowance.perDay} за сегодня`,
            allowance.scopes.join(","),
            token.userId ? `владелец ${token.userId}` : "выдан скриптом",
            token.name,
        ].join("  "),
    );
};

const list = async () => {
    const tokens = await tokensCollection();
    const items = await tokens.find({}).sort({ createdAt: -1 }).toArray();

    if (!items.length) {
        console.log("Ключей нет.");
        return;
    }

    console.log(`Ключей: ${items.length}`);
    for (const item of items) await describe(item);
};

const issue = async () => {
    const name = option("name");
    if (!name) throw new Error("--name обязателен: по нему ключ потом узнают в списке");

    const tier = (option("tier") ?? "partner") as Tier;
    if (!TIERS[tier]) throw new Error(`--tier должен быть одним из: ${Object.keys(TIERS).join(", ")}`);

    const days = number("days");
    const doc: Omit<ApiToken, "_id" | "hash" | "prefix"> = {
        name,
        userId: null,
        tier,
        createdAt: new Date(),
        expiresAt: days ? new Date(Date.now() + days * 86400_000) : null,
        revokedAt: null,
        ...(number("limit") ? { limit: number("limit") } : {}),
        ...(number("window") ? { windowSeconds: number("window") } : {}),
        ...(option("per-day") ? { perDay: option("per-day") === "none" ? null : number("per-day")! } : {}),
        ...(readScopes() ? { scopes: readScopes() } : {}),
    };

    const allowance = allowanceFor(doc as ApiToken);
    console.log(`Ключ «${name}», тариф ${tier}: ${allowance.limit} запросов за ${allowance.windowSeconds} с, ` +
        `${allowance.perDay === null ? "без суточного потолка" : `${allowance.perDay} в сутки`}, ` +
        `разделы ${allowance.scopes.join(",")}` +
        `${doc.expiresAt ? `, до ${doc.expiresAt.toISOString().slice(0, 10)}` : ""}`);

    if (!APPLY) {
        console.log("Холостой прогон — ключ не выпущен. Повторите с --apply.");
        return;
    }

    const plain = generateToken();
    const tokens = await tokensCollection();
    await tokens.insertOne({ ...doc, hash: hashToken(plain), prefix: tokenPrefix(plain) } as ApiToken);

    console.log("\nКлюч (показывается один раз):");
    console.log(plain);
};

const byId = (): ObjectId => {
    const id = option("id");
    if (!id || !ObjectId.isValid(id)) throw new Error("--id обязателен и должен быть идентификатором ключа (см. list)");
    return new ObjectId(id);
};

const set = async () => {
    const id = byId();
    const patch: Partial<ApiToken> = {
        ...(number("limit") ? { limit: number("limit") } : {}),
        ...(number("window") ? { windowSeconds: number("window") } : {}),
        ...(option("per-day") ? { perDay: option("per-day") === "none" ? null : number("per-day")! } : {}),
        ...(readScopes() ? { scopes: readScopes() } : {}),
        ...(option("tier") ? { tier: option("tier") as Tier } : {}),
        ...(option("name") ? { name: option("name")! } : {}),
    };

    if (!Object.keys(patch).length) throw new Error("Нечего менять: укажите --limit, --window, --per-day, --scopes, --tier или --name");

    console.log(`Ключу ${id.toHexString()} будет установлено:`, patch);

    if (!APPLY) {
        console.log("Холостой прогон — ничего не изменено. Повторите с --apply.");
        return;
    }

    const tokens = await tokensCollection();
    const result = await tokens.updateOne({ _id: id }, { $set: patch });
    console.log(result.matchedCount ? "Готово." : "Ключ не найден.");
};

const revoke = async () => {
    const id = byId();
    console.log(`Ключ ${id.toHexString()} будет отозван.`);

    if (!APPLY) {
        console.log("Холостой прогон — ничего не изменено. Повторите с --apply.");
        return;
    }

    const tokens = await tokensCollection();
    const result = await tokens.updateOne({ _id: id }, { $set: { revokedAt: new Date() } });
    // Приложение держит ключи в кэше до полуминуты — отзыв доедет с этой задержкой.
    console.log(result.matchedCount ? "Отозван (вступит в силу в течение полуминуты)." : "Ключ не найден.");
};

async function main() {
    switch (command) {
        case "list": return list();
        case "issue": return issue();
        case "set": return set();
        case "revoke": return revoke();
        default:
            console.log("Команды: list, issue, set, revoke. Подробности — в шапке файла.");
    }
}

main().then(() => process.exit(0)).catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
});
