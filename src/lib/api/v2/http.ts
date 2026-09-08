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
    kind: "site" | "token" | "anonymous" | "user";
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

    // Ответ по сессии непубличен не заголовками об остатке, а телом: там чужие
    // имена. Правило стоит здесь, а не только в respondPrivate, нарочно — чтобы
    // личный маршрут, списанный с публичного и оставивший respond, всё равно не
    // попал в общий кэш. Оплошность тут стоит дороже лишней строки.
    if (access.kind === "user") {
        return { ...access.headers, "Cache-Control": "private, no-store", "Vary": "Cookie, Authorization" };
    }

    if (access.kind !== "token") return access.headers;

    return { ...access.headers, "Cache-Control": "private, no-store", "Vary": "Authorization" };
};

/** Одиночный ресурс — объектом, без обёртки. */
export const respond = (
    body: unknown,
    { maxAge = DEFAULT_MAX_AGE, headers = {}, access }: RespondOptions = {},
) => NextResponse.json(body, { headers: { ...baseHeaders(maxAge), ...accessHeaders(access), ...headers } });

/**
 * Ответ с личными данными: помянник, поданные записки.
 *
 * Отдельный ответчик, а не `respond` с чужими заголовками, потому что убрать надо
 * ТРИ вещи, и каждая по своей причине.
 *
 * **Лицензия.** `baseHeaders` штампует `X-License: CC-BY-4.0` и `Link: rel=license`
 * на всё подряд — верно для корпуса, ложь на списке чужой родни: под свободной
 * лицензией эти имена не выкладывал никто.
 *
 * **Кэш.** `public, max-age` на личном ответе — это выдача одного человека всем
 * остальным через общий кэш.
 *
 * **CORS.** `Access-Control-Allow-Origin: *` открывает чтение помянника любой
 * странице, где читатель залогинен. Личным маршрутам CORS не нужен вовсе: браузеру
 * есть куда ходить и без v2, а приложение заголовками не связано.
 */
export const respondPrivate = (
    body: unknown,
    { headers = {}, access, status = 200 }: {
        headers?: Record<string, string>;
        access?: RespondAccess;
        status?: number;
    } = {},
) => NextResponse.json(body, {
    status,
    headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, no-store",
        "Vary": "Cookie, Authorization",
        "X-Robots-Tag": "noindex, nofollow",
        ...(access?.headers ?? {}),
        ...headers,
    },
});

/** Личная коллекция в том же конверте, что и публичная. */
export const respondPrivateCollection = <T>(
    items: T[],
    meta: CollectionMeta,
    options?: { headers?: Record<string, string>; access?: RespondAccess; status?: number },
) => respondPrivate({ items, ...meta }, options);

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
    | "session_required"
    | "conflict"
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
    // Ключ есть, а сессии нет: личный раздел, и открывать его нечем. Отдельно от
    // `unauthorized` — и это не оттенок смысла, а условие работоспособности
    // клиента. Приложение по «401 на запрос с ключом» объявляет ключ мёртвым и
    // уходит в анонимы всем корпусом (см. lib/api/v2/api_key.dart). Сессия сайта
    // живёт час, то есть без отдельного кода каждая установка убивала бы общий
    // ключ приложения к концу первого часа — и не в помяннике, а в Библии,
    // поиске и календаре.
    session_required: 401,
    // Запрос верен, и отказ не в нём: в помяннике больше пятисот имён не держат.
    // Через `bad_request` это читалось бы как ошибка клиента, а сказать надо
    // ровно то, что случилось.
    conflict: 409,
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
