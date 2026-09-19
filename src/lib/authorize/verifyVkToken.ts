import {reportError} from "@/lib/reportError";

/**
 * Кому принадлежит токен VK ID — спрашиваем у самого VK.
 *
 * Обмен кода идёт в браузере (VK ID SDK, публичный клиент с PKCE), и серверу
 * приходит его итог. Прежде сервер брал оттуда `user_id` на веру: зная чужой
 * числовой идентификатор VK — а они публичны, — можно было войти под чужой
 * записью одним запросом. Теперь на веру не берётся ничего: токен предъявляется
 * VK, и идентификатор берётся из ЕГО ответа. Чужой или выданный другому
 * приложению токен VK отвергнет сам — `client_id` в запросе наш.
 */
const USER_INFO_URL = "https://id.vk.com/oauth2/user_info";
const TIMEOUT_MS = 8000;

export const verifyVkAccessToken = async (accessToken: unknown): Promise<string | undefined> => {
    const clientId = process.env.VK_APP;
    if (!clientId || typeof accessToken !== "string" || !accessToken || accessToken.length > 4096) {
        return undefined;
    }
    try {
        const response = await fetch(`${USER_INFO_URL}?client_id=${encodeURIComponent(clientId)}`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ client_id: clientId, access_token: accessToken }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
            cache: "no-store",
        });
        if (!response.ok) return undefined;
        const payload = await response.json();
        const userId = payload?.user?.user_id;
        if (payload?.error || (typeof userId !== "string" && typeof userId !== "number")) return undefined;
        const id = String(userId);
        return /^\d+$/.test(id) ? id : undefined;
    } catch (e) {
        reportError(e, { where: "lib/authorize/verifyVkToken#verifyVkAccessToken" });
        return undefined;
    }
};
