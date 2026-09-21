import "server-only";
import {reportError} from "@/lib/reportError";
import {SITE_URL} from "@/utils/site";

/**
 * Вход через Яндекс ID — по коду авторизации, а не по токену из браузера.
 *
 * Разница не формальная, и она же — причина, по которой здесь не повторён приём
 * соседних веток. У Google мы проверяем `id_token`: он подписан и в нём написано,
 * КОМУ он выдан, поэтому чужой не подойдёт. У Telegram то же самое даёт подпись
 * полей ключом нашего бота. У Яндекса в браузерном варианте на руках оказывается
 * обычный токен доступа, а по токену видно, чей он, но не видно, какому
 * приложению выдан. Прими мы такой токен телом запроса — вошедший в любое другое
 * приложение Яндекса прислал бы свой токен сюда и вошёл бы под тем же именем.
 *
 * Поэтому браузер приносит не токен, а одноразовый код, и обменивает его на
 * токен сервер, предъявляя секрет приложения. Обменять код может только тот, у
 * кого секрет есть, — и попасть этот токен может только к нам.
 */

const AUTHORIZE_URL = "https://oauth.yandex.ru/authorize";
const TOKEN_URL = "https://oauth.yandex.ru/token";
const INFO_URL = "https://login.yandex.ru/info?format=json";

/**
 * Куда Яндекс возвращает после входа. Значение сверяется у него в настройках
 * приложения ДО знака, поэтому оно выводится из одного адреса сайта, а не
 * набирается второй раз. Переменной окружения его можно перебить — это нужно
 * для разработки, где сайт живёт на localhost.
 */
export const yandexRedirectUrl = (): string =>
    process.env.YANDEX_REDIRECT_URL || `${SITE_URL}/api/login/yandex/callback`;

/** Без пары «идентификатор — секрет» вход не «сломан», а не настроен. */
export const isYandexConfigured = (): boolean =>
    !!process.env.YANDEX_CLIENT_ID && !!process.env.YANDEX_CLIENT_SECRET;

export const buildYandexAuthorizeUrl = (state: string): string => {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", process.env.YANDEX_CLIENT_ID!);
    url.searchParams.set("redirect_uri", yandexRedirectUrl());
    url.searchParams.set("state", state);
    return url.toString();
};

/** Код в обмен на токен. `null` — обмен не состоялся, входа нет. */
export const exchangeYandexCode = async (code: string): Promise<string | null> => {
    try {
        const res = await fetch(TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                client_id: process.env.YANDEX_CLIENT_ID!,
                client_secret: process.env.YANDEX_CLIENT_SECRET!,
                redirect_uri: yandexRedirectUrl(),
            }),
            // Обмен идёт внутри запроса читателя: ждать ответа дольше нескольких
            // секунд незачем, лучше сказать «не вышло» и дать войти заново.
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return typeof data?.access_token === "string" ? data.access_token : null;
    } catch (e) {
        reportError(e, { where: "lib/authorize/yandex#exchangeYandexCode" });
        return null;
    }
};

/**
 * Кто вошёл. Берём только идентификатор: почта и имя нам для входа не нужны, а
 * всё, что взято, пришлось бы хранить и объяснять.
 */
export const fetchYandexUserId = async (accessToken: string): Promise<string | null> => {
    try {
        const res = await fetch(INFO_URL, {
            headers: { Authorization: `OAuth ${accessToken}` },
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const id = data?.id;
        return typeof id === "string" && /^\d+$/.test(id) ? id : null;
    } catch (e) {
        reportError(e, { where: "lib/authorize/yandex#fetchYandexUserId" });
        return null;
    }
};
