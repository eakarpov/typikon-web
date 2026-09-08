import { consume, clientIpFromHeaders } from "@/lib/rateLimit";
import { fail } from "@/lib/api/v2/http";
import {
    ANONYMOUS_ALLOWANCE,
    SITE_ALLOWANCE,
    allowanceFor,
    isSiteRequest,
    readBearer,
    tokenState,
    type Allowance,
    type ApiToken,
    type Scope,
} from "@/lib/api/v2/tokens";
import { findToken, touchToken } from "@/lib/api/v2/tokenStore";
import { spendDaily } from "@/lib/api/v2/usage";
import { SITE_HOST } from "@/utils/site";

// Кто и на каких правах спрашивает публичный API.
//
// Три вида обращений, и различать их приходится по-разному:
//
//   * свои страницы — тот же сайт из браузера (поиск, случайный текст, редактор дня);
//     ключа у них быть не может, признаются по заголовкам браузера (isSiteRequest);
//   * ключ — приложение и любой внешний потребитель. Ключ переживает смену адреса,
//     отзывается поштучно и несёт свою порцию доступа;
//   * без ключа — маленькая порция «попробовать из документации».
//
// Сами правила (кому сколько полагается) лежат в tokens.ts и проверяются тестами;
// здесь они только применяются к живому запросу.

export type CallerKind = "site" | "token" | "anonymous";

export interface Access {
    /** Готовый отказ; если он есть, ручке остаётся вернуть его как есть. */
    denied: Response | null;
    /** Заголовки об остатке — их следует вернуть клиенту вместе с данными. */
    headers: Record<string, string>;
    kind: CallerKind;
    token: ApiToken | null;
}

const granted = (kind: CallerKind, headers: Record<string, string>, token: ApiToken | null = null): Access =>
    ({ denied: null, headers, kind, token });

const refused = (denied: Response): Access => ({ denied, headers: {}, kind: "anonymous", token: null });

/** Подсказка, куда идти за ключом. Одинаковая во всех отказах — их пишут в лог и читают глазами. */
const KEY_HINT = `Ключ заводится в профиле на ${SITE_HOST}/profile, документация — ${SITE_HOST}/api.`;

const AUTHENTICATE = { "WWW-Authenticate": 'Bearer realm="typikon", charset="UTF-8"' };

/**
 * Пропускает запрос или возвращает готовый отказ. scope — раздел API, к которому
 * относится ручка: он же определяет, хватает ли прав у ключа.
 */
export const authorize = async (request: Request, scope: Scope): Promise<Access> => {
    const headers = request.headers;
    const ip = clientIpFromHeaders(headers);
    const plain = readBearer(headers);

    if (plain) return authorizeToken(plain, scope, ip);

    if (isSiteRequest(headers)) {
        return meter("site", `site:${ip}`, SITE_ALLOWANCE);
    }

    if (!ANONYMOUS_ALLOWANCE.scopes.includes(scope)) {
        return refused(fail("unauthorized", `Этот раздел доступен по ключу. ${KEY_HINT}`, AUTHENTICATE));
    }

    return meter("anonymous", `anon:${ip}`, ANONYMOUS_ALLOWANCE);
};

/**
 * Как `authorize`, но плохой ключ не запирает ручку.
 *
 * Заведено ради проверки версий, и причина в порядке работ, а не в удобстве.
 * Ручка версии — то единственное, чем установленная копия узнаёт о новой; если
 * закрыть её отказом «ключ отозван», приложение перестанет узнавать в том числе
 * о той версии, которая этот отказ и чинит. Отзыв ключа обязан быть заменой, а
 * не выключателем, — здесь это правило и держится.
 *
 * Годный ключ по-прежнему в чести: он даёт приложению его порцию по устройству,
 * а не общую анонимную по адресу. Последнее важнее, чем кажется: за одним
 * адресом оператора сидят десятки телефонов, и шестидесяти запросов в час на
 * всех им не хватило бы.
 *
 * Мимо счётчика при этом никто не проходит: не признанный ключ считается как
 * аноним, а исчерпанный лимит остаётся отказом — на анонимную порцию с него не
 * перепрыгнуть.
 */
export const authorizeOpen = async (request: Request, scope: Scope): Promise<Access> => {
    const headers = request.headers;
    const ip = clientIpFromHeaders(headers);
    const plain = readBearer(headers);

    if (plain) {
        const token = await findToken(plain);
        // Годен — дальше обычным путём, со всеми его лимитами и квотами.
        if (token && tokenState(token) === "ok") return authorizeToken(plain, scope, ip);
    }

    if (isSiteRequest(headers)) return meter("site", `site:${ip}`, SITE_ALLOWANCE);

    return meter("anonymous", `anon:${ip}`, ANONYMOUS_ALLOWANCE);
};

const authorizeToken = async (plain: string, scope: Scope, ip: string): Promise<Access> => {
    const token = await findToken(plain);

    if (!token) {
        return refused(fail("unauthorized", `Ключ не признан. ${KEY_HINT}`, AUTHENTICATE));
    }

    const state = tokenState(token);
    if (state !== "ok") {
        const reason = state === "revoked" ? "Ключ отозван." : "Срок действия ключа истёк.";
        return refused(fail("unauthorized", `${reason} ${KEY_HINT}`, AUTHENTICATE));
    }

    const allowance = allowanceFor(token);

    if (!allowance.scopes.includes(scope)) {
        return refused(fail("forbidden", `Ключ не даёт доступа к разделу «${scope}».`));
    }

    const id = token._id.toHexString();
    // Ключ, зашитый в приложение, общий для всех его пользователей — минутный лимит
    // такому считаем по устройству, иначе один пользователь выбирает его на всех.
    const key = allowance.perClient ? `token:${id}:${ip}` : `token:${id}`;

    const metered = meter("token", key, allowance, token);
    if (metered.denied) return metered;

    // Подушевой потолок — только там, где ключ общий на много устройств: у ключа,
    // выданного одному потребителю, делить нечего.
    const quota = await spendDaily(token._id, allowance.perDay, new Date(),
        allowance.perClient && allowance.perDevice != null
            ? { client: ip, perDevice: allowance.perDevice }
            : null);

    if (!quota.allowed) {
        // Какая именно квота кончилась, сказать надо: «исчерпана квота ключа» на
        // подушевом потолке увело бы отладку к тарифу, тогда как дело в одном
        // устройстве, и остальные работают.
        const own = allowance.perDevice != null && quota.limit === allowance.perDevice;

        return refused(fail(
            "quota_exceeded",
            own
                ? `Исчерпана суточная доля устройства (${quota.limit}). ` +
                  `Обновится через ${Math.ceil(quota.resetIn / 60)} мин.`
                : `Исчерпана суточная квота ключа (${quota.limit}). ` +
                  `Обновится через ${Math.ceil(quota.resetIn / 60)} мин.`,
            {
                "Retry-After": String(quota.resetIn),
                "X-Quota-Limit": String(quota.limit),
                "X-Quota-Remaining": "0",
                "X-Quota-Reset": String(quota.resetIn),
            },
        ));
    }

    touchToken(token._id);

    if (quota.limit !== null) {
        metered.headers["X-Quota-Limit"] = String(quota.limit);
        metered.headers["X-Quota-Remaining"] = String(quota.remaining);
        metered.headers["X-Quota-Reset"] = String(quota.resetIn);
    }

    return metered;
};

/** Минутный (или часовой) счётчик. Общий для всех трёх видов обращений. */
const meter = (
    kind: CallerKind,
    key: string,
    allowance: Allowance,
    token: ApiToken | null = null,
): Access => {
    const verdict = consume(key, allowance.limit, allowance.windowSeconds);

    if (!verdict.allowed) {
        // Анониму заодно объясняем, что упёрся он в порцию «попробовать», а не в стену.
        const hint = kind === "anonymous" ? ` Больше — по ключу. ${KEY_HINT}` : "";

        return refused(fail("rate_limited", `Слишком часто. Повторите через ${verdict.retryAfter} с.${hint}`, {
            "Retry-After": String(verdict.retryAfter),
            "X-RateLimit-Limit": String(verdict.limit),
            "X-RateLimit-Remaining": "0",
        }));
    }

    return granted(kind, {
        "X-RateLimit-Limit": String(verdict.limit),
        "X-RateLimit-Remaining": String(verdict.remaining),
        "X-RateLimit-Window": String(allowance.windowSeconds),
    }, token);
};
