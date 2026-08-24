import { consume, clientIpFromHeaders } from "@/lib/rateLimit";
import { fail } from "@/lib/api/v2/http";

// Лимит для публичного API. Щедрее, чем у поиска: обычный клиент, обходящий корпус,
// не должен упираться в стену, а вот выкачивание всего подряд в один поток — должно.
export const API_LIMIT = { limit: 120, windowSeconds: 60 };

/**
 * Возвращает null, если запрос пропущен, и готовый ответ 429, если нет —
 * ручке остаётся вернуть его как есть.
 */
export const limitOrFail = (request: Request, name = "api-v2") => {
    const verdict = consume(
        `${name}:${clientIpFromHeaders(request.headers)}`,
        API_LIMIT.limit,
        API_LIMIT.windowSeconds,
    );

    if (verdict.allowed) return null;

    return fail("rate_limited", `Слишком часто. Повторите через ${verdict.retryAfter} с.`, {
        "Retry-After": String(verdict.retryAfter),
        "X-RateLimit-Limit": String(verdict.limit),
        "X-RateLimit-Remaining": "0",
    });
};
