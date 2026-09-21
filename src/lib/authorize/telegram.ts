import {createHash, createHmac, timingSafeEqual} from "node:crypto";

/**
 * Проверка данных виджета входа Telegram.
 *
 * Строку для подписи собирает СЕРВЕР — из тех самых полей, из которых потом
 * берётся идентификатор. Прежде строку присылал клиент, а идентификатор шёл
 * отдельным полем, в подпись не входившим: верная пара «строка — подпись» от
 * своей записи годилась для входа под любой чужой.
 *
 * Правило Telegram: все поля, кроме `hash`, парами `ключ=значение`, по алфавиту,
 * через перевод строки; ключ HMAC — SHA-256 от токена бота.
 */

/** Сколько живёт подписанный ответ виджета. Перехваченная пара не вечна. */
export const TELEGRAM_AUTH_MAX_AGE_SEC = 24 * 60 * 60;

export type TelegramFields = Record<string, string | number | boolean>;

export type TelegramCheck =
    | { ok: true; userId: string }
    | { ok: false; reason: "no-token" | "malformed" | "bad-hash" | "stale" };

export const buildDataCheckString = (fields: TelegramFields): string =>
    Object.keys(fields)
        .filter((key) => key !== "hash")
        .sort()
        .map((key) => `${key}=${fields[key]}`)
        .join("\n");

const isScalar = (value: unknown): value is string | number | boolean =>
    typeof value === "string" || typeof value === "number" || typeof value === "boolean";

export const verifyTelegramAuth = (
    fields: unknown,
    botToken: string | undefined,
    nowSec: number = Math.floor(Date.now() / 1000),
): TelegramCheck => {
    // Без токена ключ вывелся бы из строки «undefined», и подпись подделал бы любой.
    if (!botToken) return { ok: false, reason: "no-token" };
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
        return { ok: false, reason: "malformed" };
    }
    const data = fields as Record<string, unknown>;
    if (!Object.values(data).every(isScalar)) return { ok: false, reason: "malformed" };

    const hash = data.hash;
    const id = data.id;
    const authDate = Number(data.auth_date);
    if (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)) return { ok: false, reason: "malformed" };
    if ((typeof id !== "string" && typeof id !== "number") || !/^\d+$/.test(String(id))) {
        return { ok: false, reason: "malformed" };
    }
    if (!Number.isFinite(authDate)) return { ok: false, reason: "malformed" };

    const secret = createHash("sha256").update(botToken).digest();
    const expected = createHmac("sha256", secret)
        .update(buildDataCheckString(data as TelegramFields))
        .digest();
    if (!timingSafeEqual(expected, Buffer.from(hash, "hex"))) return { ok: false, reason: "bad-hash" };

    if (nowSec - authDate > TELEGRAM_AUTH_MAX_AGE_SEC) return { ok: false, reason: "stale" };

    return { ok: true, userId: String(id) };
};
