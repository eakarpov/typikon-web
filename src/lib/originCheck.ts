import { isLegacyHost, SITE_HOST } from "@/utils/site";

/**
 * Чужой ли источник у изменяющего запроса.
 *
 * Защита от подделки межсайтовых запросов держалась на одном `SameSite=Lax` у
 * cookie сессии. Здесь вторая линия: если браузер назвал источник и он не наш —
 * запрос с сессией не принимается. Нет заголовка — не браузер (приложение,
 * скрипт с ключом): таким cookie не подсунуть, и их это не касается.
 */
const hostOf = (value: string): string | null => {
    try {
        return new URL(value).hostname.toLowerCase();
    } catch {
        return null;
    }
};

export const isForeignOrigin = (origin: string | null | undefined, requestHost: string | null | undefined): boolean => {
    if (!origin) return false;
    const host = hostOf(origin);
    // «null» и нечитаемое — источник назван, но своим быть не может.
    if (!host) return true;
    if (host === "localhost" || host === "127.0.0.1") return false;
    if (host === SITE_HOST || host.endsWith(`.${SITE_HOST}`)) return false;
    if (isLegacyHost(host)) return false;
    const own = requestHost?.split(":")[0]?.toLowerCase();
    return host !== own;
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const isUnsafeMethod = (method: string): boolean => !SAFE_METHODS.has(method.toUpperCase());
