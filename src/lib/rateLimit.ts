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

/**
 * Возвращает true, если запрос пропущен. Если лимит исчерпан — сам отвечает 429
 * и возвращает false: вызывающему остаётся просто выйти.
 */
export const rateLimit = (
    req: NextApiRequest,
    res: NextApiResponse,
    { limit, windowSeconds, name = "default" }: RateLimitOptions,
): boolean => {
    const now = Date.now();
    sweep(now);

    const key = `${name}:${clientIp(req)}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
        res.setHeader("X-RateLimit-Limit", limit);
        res.setHeader("X-RateLimit-Remaining", limit - 1);
        return true;
    }

    bucket.count++;

    if (bucket.count > limit) {
        const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
        res.setHeader("Retry-After", retryAfter);
        res.setHeader("X-RateLimit-Limit", limit);
        res.setHeader("X-RateLimit-Remaining", 0);
        res.status(429).json({ error: `Слишком часто. Повторите через ${retryAfter} с.` });
        return false;
    }

    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, limit - bucket.count));
    return true;
};

// Явные счётчики для тяжёлых публичных ручек.
export const SEARCH_LIMIT = { limit: 30, windowSeconds: 60, name: "search" };
export const DICTIONARY_LIMIT = { limit: 30, windowSeconds: 60, name: "dictionary" };
