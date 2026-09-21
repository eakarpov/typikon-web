// Отправка поста в Telegram — общая логика для крона (src/scripts/publish-channel-posts.ts)
// и для ручной кнопки "Отправить сейчас" в /admin/channel-posts (используется прямо из Next.js,
// поэтому без импортов из src/scripts — там свой бутстрап окружения через @next/env).
import { Agent, ProxyAgent, fetch as undiciFetch, RequestInfo, RequestInit } from "undici";

export interface TelegramPostInput {
    text: string;
    imageUrl?: string | null;
}

// Если api.telegram.org недоступен напрямую (блокировка у хостера/региона) — два способа обхода,
// оба включаются переменными окружения, менять код не нужно:
//   TELEGRAM_API_BASE  — базовый URL вместо https://api.telegram.org (например свой релей-воркер
//                        на Cloudflare — см. ROADMAP.md за готовым кодом воркера);
//   TELEGRAM_PROXY_URL — адрес HTTP/SOCKS5-прокси (например http://user:pass@host:port),
//                        запросы к TELEGRAM_API_BASE пойдут через него.
const TELEGRAM_API_BASE = process.env.TELEGRAM_API_BASE || "https://api.telegram.org";

const getDispatcher = () => {
    const proxyUrl = process.env.TELEGRAM_PROXY_URL;
    return proxyUrl ? new ProxyAgent(proxyUrl) : new Agent();
};

// У сетевых ошибок fetch (Node/undici) настоящая причина лежит в error.cause, а не в message —
// "fetch failed" само по себе ничего не говорит (та же история была с сертификатом dneslov.org).
export const describeFetchError = (e: unknown): string => {
    const err = e as (Error & { cause?: unknown }) | undefined;
    if (!err) return String(e);
    const cause = err.cause as (Error & { code?: string }) | undefined;
    if (!cause) return err.message || String(e);
    return `${err.message}: ${cause.code ? `[${cause.code}] ` : ""}${cause.message || cause}`;
};

/**
 * Приведение канала к тому виду, который Telegram понимает.
 *
 * `chat_id` бывает двух видов: числовой (у каналов он отрицательный) и
 * `@username`. Имя БЕЗ собаки каналом не считается, и в ответ приходит
 * «Bad Request: chat not found» — сообщение, по которому думаешь на права бота
 * или на неверный канал, а не на один недостающий знак в окружении.
 *
 * Проверить это раньше было негде: до переезда api.telegram.org с прода не был
 * доступен вовсе, и значение переменной ни разу не доходило до Telegram.
 */
export const normalizeChatId = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith("@")) return trimmed;
    if (/^-?\d+$/.test(trimmed)) return trimmed;
    return `@${trimmed}`;
};

export const sendChannelPostToTelegram = async (
    post: TelegramPostInput,
    botToken: string,
    channelId: string,
) => {
    const method = post.imageUrl ? "sendPhoto" : "sendMessage";
    const chatId = normalizeChatId(channelId);
    const body = post.imageUrl
        ? { chat_id: chatId, photo: post.imageUrl, caption: post.text, parse_mode: "HTML" }
        : { chat_id: chatId, text: post.text, parse_mode: "HTML", disable_web_page_preview: true };

    let res: Response;
    try {
        res = (await undiciFetch(`${TELEGRAM_API_BASE}/bot${botToken}/${method}` as RequestInfo, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            dispatcher: getDispatcher(),
        } as RequestInit)) as unknown as Response;
    } catch (e) {
        throw new Error(`Не удалось достучаться до ${TELEGRAM_API_BASE}: ${describeFetchError(e)}`);
    }

    const data = await res.json();
    if (!data.ok) {
        throw new Error(`Telegram: ${data.description || res.status}`);
    }
    return data.result;
};
