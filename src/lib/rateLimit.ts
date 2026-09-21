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

/**
 * Адрес клиента по заголовкам прокси.
 *
 * Первому элементу `x-forwarded-for` верить нельзя: nginx с
 * `$proxy_add_x_forwarded_for` ДОПИСЫВАЕТ увиденный адрес в конец, а начало
 * списка — то, что прислал сам клиент. Кто ставил туда случайное значение,
 * получал свежий счётчик на каждый запрос. Поэтому берётся `x-real-ip`, если
 * nginx его выставляет, иначе — ПОСЛЕДНИЙ элемент списка: его писал наш прокси.
 *
 * Это верно, пока прокси перед Node один и порт Node снаружи закрыт; при прямом
 * доступе к порту подделать можно любой заголовок.
 */
export const ipFromProxyHeaders = (
    realIp: string | null | undefined, forwarded: string | null | undefined,
): string | undefined => {
    const real = realIp?.trim();
    if (real) return real;
    const hops = forwarded?.split(",").map((hop) => hop.trim()).filter(Boolean);
    return hops?.length ? hops[hops.length - 1] : undefined;
};

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value.join(",") : value);

export const clientIp = (req: NextApiRequest): string =>
    ipFromProxyHeaders(single(req.headers["x-real-ip"]), single(req.headers["x-forwarded-for"]))
    || req.socket.remoteAddress || "unknown";

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
    ipFromProxyHeaders(headers.get("x-real-ip"), headers.get("x-forwarded-for")) || "unknown";

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
// Капча и письмо: человеку хватит с запасом, перебору и заливке ящика — нет.
export const CAPTCHA_LIMIT = { limit: 20, windowSeconds: 60, name: "captcha" };
export const CONTACT_LIMIT = { limit: 5, windowSeconds: 600, name: "contact" };
// Сборка PDF грузит процессор; страницу чтения сохраняют не чаще.
export const PDF_LIMIT = { limit: 10, windowSeconds: 60, name: "pdf" };
