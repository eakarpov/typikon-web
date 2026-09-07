import { NextResponse } from "next/server";
import { SITE_URL } from "@/utils/site";

// Общий слой ответов публичного API.
//
// Всё, что отдаётся наружу, проходит через respond/fail — поэтому заголовки лицензии,
// CORS и формат ошибок задаются в одном месте, а не повторяются в каждой ручке.

export const LICENSE_URL = `${SITE_URL}/license`;
export const LICENSE_ID = "CC-BY-4.0";

// Сутки: содержимое меняется правкой в админке, а она сбрасывает кэш тегами.
export const DEFAULT_MAX_AGE = 3600;

const baseHeaders = (maxAge: number): Record<string, string> => ({
    "Content-Type": "application/json; charset=utf-8",
    // API публичный и рассчитан на браузерные клиенты — иначе им к нему не подступиться.
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Api-Key",
    "Access-Control-Max-Age": "86400",
    // Условия использования видны прямо в ответе, без похода на сайт.
    "Link": `<${LICENSE_URL}>; rel="license"`,
    "X-License": LICENSE_ID,
    "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}`,
});

/**
 * Право на запрос: что выдал слой доступа (src/lib/api/v2/access.ts). Ответы носят
 * заголовки об остатке лимита, а ответ по ключу вдобавок помечается как непубличный —
 * иначе общий кэш отдал бы чужой остаток другому клиенту.
 */
export interface RespondAccess {
    headers: Record<string, string>;
    kind: "site" | "token" | "anonymous";
}

export interface CollectionMeta {
    total: number;
    limit: number;
    offset: number;
}

export interface RespondOptions {
    maxAge?: number;
    headers?: Record<string, string>;
    access?: RespondAccess;
}

/**
 * Тело ответа для одного и того же адреса одинаково для всех — корпус публичный, —
 * поэтому кэшировать его можно. А вот заголовки об остатке лимита у каждого свои,
 * и ради них ответ по ключу становится private с Vary по Authorization.
 */
const accessHeaders = (access?: RespondAccess): Record<string, string> => {
    if (!access) return {};
    if (access.kind !== "token") return access.headers;

    return { ...access.headers, "Cache-Control": "private, no-store", "Vary": "Authorization" };
};

/** Одиночный ресурс — объектом, без обёртки. */
export const respond = (
    body: unknown,
    { maxAge = DEFAULT_MAX_AGE, headers = {}, access }: RespondOptions = {},
) => NextResponse.json(body, { headers: { ...baseHeaders(maxAge), ...accessHeaders(access), ...headers } });

/** Коллекция — всегда в одном конверте, чтобы клиент не гадал, где считать total. */
export const respondCollection = <T>(
    items: T[],
    meta: CollectionMeta,
    options?: RespondOptions,
) => respond({ items, ...meta }, options);

export type ErrorCode =
    | "not_found"
    | "bad_request"
    | "unauthorized"
    | "forbidden"
    | "rate_limited"
    | "quota_exceeded"
    | "corpus_unavailable"
    | "internal";

const STATUS: Record<ErrorCode, number> = {
    not_found: 404,
    bad_request: 400,
    // Ключа нет, он не признан, отозван или просрочен.
    unauthorized: 401,
    // Ключ настоящий, но этого раздела не даёт.
    forbidden: 403,
    rate_limited: 429,
    // Суточная квота — тоже «слишком много», отсюда общий с частотой код состояния.
    quota_exceeded: 429,
    // Корпус — отдельный файл, и на этом сервере его может не быть (см.
    // @/lib/rulesDb). Это не поломка: сервер цел, данных под рукой нет. Отсюда
    // 503, а не 500 — и отдельный код, чтобы клиенту не приходилось сличать
    // русскую строку сообщения, отличая «корпуса нет» от «поиск сломался».
    corpus_unavailable: 503,
    internal: 500,
};

/**
 * Те же коды списком — чтобы описание API собиралось из них, а не переписывалось
 * руками. Выводятся из таблицы статусов, а не перечисляются вторым списком:
 * `Record<ErrorCode, number>` полон по типу, значит и список полон, и разойтись
 * им негде. Переписанный руками разошёлся бы — в openapi.json значилось четыре
 * кода из семи, и клиент, готовый к перечисленным, встречал неизвестные.
 */
export const ERROR_CODES = Object.keys(STATUS) as ErrorCode[];

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
