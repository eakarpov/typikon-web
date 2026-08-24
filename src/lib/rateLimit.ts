import type { NextApiRequest, NextApiResponse } from "next";

// Ограничение частоты запросов для публичных ручек.
//
// Счётчики держатся в памяти процесса — этого достаточно, потому что сайт работает
// одним процессом Node под systemd (typikon-web.service). Если когда-нибудь появится
// несколько процессов или машин, счётчики придётся вынести наружу (Redis и подобное),
// и вот тогда это станет неправдой — оставляю пометку здесь.
//
// Задача не «защититься от злоумышленника», а не дать одному клиенту случайно
// (кривым циклом, кнопкой на удержании) занять собой весь поиск по 12 млн символов.

interface Bucket {
    count: number;
    resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Чтобы карта не росла бесконечно от разовых посетителей, изредка подчищаем истёкшее.
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

const sweep = (now: number) => {
    if (now - lastSweep < SWEEP_INTERVAL_MS) return;
    lastSweep = now;
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
    }
};

// За nginx настоящий адрес приходит в x-forwarded-for; первый в списке — клиент.
export const clientIp = (req: NextApiRequest): string => {
    const forwarded = req.headers["x-forwarded-for"];
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const first = raw?.split(",")[0]?.trim();
    return first || req.socket.remoteAddress || "unknown";
};

export interface RateLimitOptions {
    /** Сколько запросов разрешено в окне. */
    limit: number;
    /** Длина окна в секундах. */
    windowSeconds: number;
    /** Своё имя счётчика, если ручек несколько и лимиты у них разные. */
    name?: string;
}

export interface RateVerdict {
    allowed: boolean;
    limit: number;
    remaining: number;
    retryAfter: number;
}

/**
 * Ядро без привязки к виду запроса: pages-роутер и app-роутер устроены по-разному,
 * а счётчик у них должен быть один.
 */
export const consume = (key: string, limit: number, windowSeconds: number): RateVerdict => {
    const now = Date.now();
    sweep(now);

    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
        return { allowed: true, limit, remaining: limit - 1, retryAfter: 0 };
    }

    bucket.count++;

    if (bucket.count > limit) {
        return {
            allowed: false,
            limit,
            remaining: 0,
            retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
        };
    }

    return { allowed: true, limit, remaining: Math.max(0, limit - bucket.count), retryAfter: 0 };
};

/** Адрес клиента из обычного Request (app-роутер). */
export const clientIpFromHeaders = (headers: Headers): string =>
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

/**
 * Возвращает true, если запрос пропущен. Если лимит исчерпан — сам отвечает 429
 * и возвращает false: вызывающему остаётся просто выйти.
 */
export const rateLimit = (
    req: NextApiRequest,
    res: NextApiResponse,
    { limit, windowSeconds, name = "default" }: RateLimitOptions,
): boolean => {
    const verdict = consume(`${name}:${clientIp(req)}`, limit, windowSeconds);

    res.setHeader("X-RateLimit-Limit", verdict.limit);
    res.setHeader("X-RateLimit-Remaining", verdict.remaining);

    if (!verdict.allowed) {
        res.setHeader("Retry-After", verdict.retryAfter);
        res.status(429).json({ error: `Слишком часто. Повторите через ${verdict.retryAfter} с.` });
        return false;
    }

    return true;
};

// Явные счётчики для тяжёлых публичных ручек.
export const SEARCH_LIMIT = { limit: 30, windowSeconds: 60, name: "search" };
export const DICTIONARY_LIMIT = { limit: 30, windowSeconds: 60, name: "dictionary" };
