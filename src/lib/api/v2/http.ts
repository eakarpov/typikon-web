import { NextResponse } from "next/server";

// Общий слой ответов публичного API.
//
// Всё, что отдаётся наружу, проходит через respond/fail — поэтому заголовки лицензии,
// CORS и формат ошибок задаются в одном месте, а не повторяются в каждой ручке.

export const LICENSE_URL = "https://typikon.su/license";
export const LICENSE_ID = "CC-BY-4.0";

// Сутки: содержимое меняется правкой в админке, а она сбрасывает кэш тегами.
export const DEFAULT_MAX_AGE = 3600;

const baseHeaders = (maxAge: number): Record<string, string> => ({
    "Content-Type": "application/json; charset=utf-8",
    // API публичный и рассчитан на браузерные клиенты — иначе им к нему не подступиться.
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    // Условия использования видны прямо в ответе, без похода на сайт.
    "Link": `<${LICENSE_URL}>; rel="license"`,
    "X-License": LICENSE_ID,
    "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}`,
});

export interface CollectionMeta {
    total: number;
    limit: number;
    offset: number;
}

/** Одиночный ресурс — объектом, без обёртки. */
export const respond = (
    body: unknown,
    { maxAge = DEFAULT_MAX_AGE, headers = {} }: { maxAge?: number; headers?: Record<string, string> } = {},
) => NextResponse.json(body, { headers: { ...baseHeaders(maxAge), ...headers } });

/** Коллекция — всегда в одном конверте, чтобы клиент не гадал, где считать total. */
export const respondCollection = <T>(
    items: T[],
    meta: CollectionMeta,
    options?: { maxAge?: number; headers?: Record<string, string> },
) => respond({ items, ...meta }, options);

export type ErrorCode =
    | "not_found"
    | "bad_request"
    | "rate_limited"
    | "internal";

const STATUS: Record<ErrorCode, number> = {
    not_found: 404,
    bad_request: 400,
    rate_limited: 429,
    internal: 500,
};

/** Ошибка всегда с телом: пустой 400 не говорит клиенту ничего. */
export const fail = (
    code: ErrorCode,
    message: string,
    headers: Record<string, string> = {},
) =>
    NextResponse.json(
        { error: { code, message } },
        {
            status: STATUS[code],
            headers: { ...baseHeaders(0), "Cache-Control": "no-store", ...headers },
        },
    );

/** Предполётный запрос браузера. */
export const preflight = () => new NextResponse(null, { status: 204, headers: baseHeaders(86400) });
