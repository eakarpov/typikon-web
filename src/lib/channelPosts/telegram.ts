// Отправка поста в Telegram — общая логика для крона (src/scripts/publish-channel-posts.ts)
// и для ручной кнопки "Отправить сейчас" в /admin/channel-posts (используется прямо из Next.js,
// поэтому без импортов из src/scripts — там свой бутстрап окружения через @next/env).
// FormData берётся ИЗ UNDICI, а не глобальная. Они разные объекты, и undici
// проверяет тело на свою: глобальную он не узнаёт и отправляет строкой
// «[object FormData]» — семнадцать байт вместо картинки, причём молча, с
// успешным ответом на том конце.
import { Agent, ProxyAgent, fetch as undiciFetch, FormData, RequestInfo, RequestInit } from "undici";

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

/**
 * Картинка уходит ФАЙЛОМ, а не ссылкой.
 *
 * По ссылке Telegram забирает её сам — и на webp отвечает «failed to get HTTP
 * URL content»: webp у него формат стикеров, фотографией по URL он его не
 * берёт. А в снимке святцев все изображения именно webp, других там нет вовсе.
 * Те же байты, отправленные multipart, он принимает и раскладывает по своим
 * размерам — проверено живым ботом.
 *
 * TLS-послабление здесь своё, хотя точно такое же есть в scripts/lib/dneslov:
 * у dneslov.org неполная цепочка сертификатов, а картинка лежит на их же CDN.
 * Импортировать оттуда нельзя — этот модуль зовётся и из Next (см. шапку файла),
 * а там свой бутстрап окружения.
 */
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

let plainAgent: Agent | null = null;
let insecureAgent: Agent | null = null;

const imageDispatcher = () => {
    if (process.env.DNESLOV_INSECURE_TLS === "true") {
        insecureAgent ||= new Agent({ connect: { rejectUnauthorized: false } });
        return insecureAgent;
    }
    plainAgent ||= new Agent();
    return plainAgent;
};

const downloadImage = async (url: string): Promise<{ blob: Blob; filename: string } | null> => {
    try {
        const res = (await undiciFetch(url as RequestInfo, {
            dispatcher: imageDispatcher(),
            signal: AbortSignal.timeout(20_000),
        } as RequestInit)) as unknown as Response;
        if (!res.ok) {
            console.warn(`картинка ${url}: ответ ${res.status}`);
            return null;
        }

        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.byteLength > MAX_PHOTO_BYTES) {
            console.warn(`картинка ${url}: ${bytes.byteLength} байт — больше предела Telegram`);
            return null;
        }

        return {
            blob: new Blob([bytes], { type: res.headers.get("content-type") || "application/octet-stream" }),
            // Имя файла Telegram тоже смотрит, поэтому берём последний кусок пути.
            filename: url.split("/").pop()?.split("?")[0] || "image",
        };
    } catch (e) {
        console.warn(`картинка ${url} не скачалась: ${describeFetchError(e)}`);
        return null;
    }
};

/** Один вызов к Telegram. Сетевой сбой и отказ самого Telegram различаются текстом. */
const request = async (botToken: string, method: string, init: RequestInit) => {
    let res: Response;
    try {
        res = (await undiciFetch(`${TELEGRAM_API_BASE}/bot${botToken}/${method}` as RequestInfo, {
            method: "POST",
            dispatcher: getDispatcher(),
            ...init,
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

const call = (botToken: string, method: string, body: Record<string, unknown>) =>
    request(botToken, method, {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    } as RequestInit);

// Content-Type для multipart проставляет сам fetch — вместе с границей частей,
// которую вручную не угадать.
const callForm = (botToken: string, method: string, form: FormData) =>
    request(botToken, method, { body: form } as unknown as RequestInit);

export const sendChannelPostToTelegram = async (
    post: TelegramPostInput,
    botToken: string,
    channelId: string,
) => {
    const chatId = normalizeChatId(channelId);

    // КАРТИНКА НЕ ДОЛЖНА УНОСИТЬ С СОБОЙ ПОСТ. Прежде отказ на ней означал, что
    // в канал не ушло вообще ничего, а пост оседал в `failed` и больше не
    // повторялся. Причин отказа именно на картинке уже известно две:
    //
    //   * формат — вылечен отправкой файлом (см. downloadImage выше);
    //   * длина подписи. У фотографии подпись ограничена 1024 знаками, тогда
    //     как сам пост бывает вчетверо длиннее, и такой уходит без картинки.
    //     Предугадывать эту длину здесь нельзя: Telegram считает знаки уже
    //     разобранного текста, без разметки, и наша оценка была бы завышенной.
    //     Поэтому решение оставлено ему, а нам остаётся откат.
    //
    // Правило же верно при любом исходе: лучше пост без картинки, чем ничего.
    const image = post.imageUrl ? await downloadImage(post.imageUrl) : null;

    if (image) {
        try {
            const form = new FormData();
            form.set("chat_id", chatId);
            form.set("caption", post.text);
            form.set("parse_mode", "HTML");
            form.set("photo", image.blob, image.filename);
            return await callForm(botToken, "sendPhoto", form);
        } catch (e) {
            console.warn(`картинка не ушла (${(e as Error).message}) — отправляю пост без неё`);
        }
    } else if (post.imageUrl) {
        console.warn("картинка не получена — отправляю пост без неё");
    }

    return call(botToken, "sendMessage", {
        chat_id: chatId,
        text: post.text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
    });
};
