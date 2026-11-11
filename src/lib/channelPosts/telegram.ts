// Отправка поста в Telegram — общая логика для крона (src/scripts/publish-channel-posts.ts)
// и для ручной кнопки "Отправить сейчас" в /admin/channel-posts (используется прямо из Next.js,
// поэтому без импортов из src/scripts — там свой бутстрап окружения через @next/env).
// FormData берётся ИЗ UNDICI, а не глобальная. Они разные объекты, и undici
// проверяет тело на свою: глобальную он не узнаёт и отправляет строкой
// «[object FormData]» — семнадцать байт вместо картинки, причём молча, с
// успешным ответом на том конце.
import { checkTelegramPhoto, checkTelegramText } from "./checkContent";
import type { TelegramPostCheck } from "@/types/dto/channelPost";
import { photoCaption } from "./photoCaption";
import { createHash } from "node:crypto";
import type { TelegramDelivery } from "@/types/dto/channelPost";
import { Agent, ProxyAgent, fetch as undiciFetch, FormData, RequestInfo, RequestInit } from "undici";

export interface TelegramPostInput {
    text: string;
    imageUrl?: string | null;
    telegramDelivery?: TelegramDelivery | null;
    sourceTextId?: string | null;
}

// Если api.telegram.org недоступен напрямую (блокировка у хостера/региона) — два способа обхода,
// оба включаются переменными окружения, менять код не нужно:
//   TELEGRAM_API_BASE  — базовый URL вместо https://api.telegram.org (например свой релей-воркер
//                        на Cloudflare — готовый код воркера — telegram-relay/worker.js);
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

type Fetch = typeof undiciFetch;

const downloadImage = async (url: string, fetchImage: Fetch) => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetchImage(url as RequestInfo, {
                dispatcher: imageDispatcher(),
                signal: AbortSignal.timeout(20_000),
            } as RequestInit);
            if (!res.ok) {
                await res.body?.cancel();
                const error = new Error(`Не удалось загрузить фотографию: HTTP ${res.status}`);
                if (res.status < 500 && res.status !== 429) throw error;
                lastError = error;
                continue;
            }
            const bytes = new Uint8Array(await res.arrayBuffer());
            if (!bytes.byteLength) throw new Error("Файл фотографии пуст");
            if (bytes.byteLength > MAX_PHOTO_BYTES) {
                throw new Error("Фотография больше допустимых 10 МБ");
            }
            return {
                blob: new Blob([bytes], { type: res.headers.get("content-type") || "application/octet-stream" }),
                filename: new URL(url).pathname.split("/").pop() || "image",
            };
        } catch (e) {
            // Повторяем только безопасное скачивание при сетевом сбое, не отправку поста.
            if (!(e instanceof TypeError) && !(e instanceof Error && e.name === "TimeoutError")) throw e;
            lastError = e;
        }
    }
    throw new Error(`Не удалось загрузить фотографию: ${describeFetchError(lastError)}. Пост не отправлен.`);
};

class TelegramError extends Error {
    constructor(public code: number, public description: string) {
        super(`Telegram: ${description}`);
    }
}

/** Один вызов к Telegram. Сетевой сбой и отказ самого Telegram различаются текстом. */
const request = async (fetchTelegram: Fetch, botToken: string, method: string, init: RequestInit) => {
    let res: Response;
    try {
        res = (await fetchTelegram(`${TELEGRAM_API_BASE}/bot${botToken}/${method}` as RequestInfo, {
            method: "POST",
            dispatcher: getDispatcher(),
            ...init,
        } as RequestInit)) as unknown as Response;
    } catch (e) {
        throw new Error(`Не удалось достучаться до ${TELEGRAM_API_BASE}: ${describeFetchError(e)}`);
    }

    const data = await res.json();
    if (!data.ok) {
        throw new TelegramError(data.error_code || res.status, data.description || String(res.status));
    }
    return data.result;
};

export interface TelegramSendOptions {
    // Сохраняем результат, чтобы повтор отправки не дублировал опубликованный пост.
    saveDelivery?: (delivery: TelegramDelivery) => Promise<void>;
    fetch?: Fetch;
}

export const sendChannelPostToTelegram = async (
    post: TelegramPostInput,
    botToken: string,
    channelId: string,
    options: TelegramSendOptions = {},
) => {
    const chatId = normalizeChatId(channelId);
    const fetchTelegram = options.fetch || undiciFetch;
    const imageUrl = post.imageUrl?.trim() || "";
    const fingerprint = createHash("sha256").update(JSON.stringify([chatId, imageUrl, post.text])).digest("hex");
    let delivery: TelegramDelivery = post.telegramDelivery?.fingerprint === fingerprint
        ? post.telegramDelivery : { fingerprint, complete: false };
    const save = async (next: TelegramDelivery) => {
        await options.saveDelivery?.(next);
        delivery = next;
    };
    const call = (method: string, body: Record<string, unknown>) => request(fetchTelegram, botToken, method, {
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (delivery.complete) return { message_id: delivery.messageId };

    if (imageUrl) {
        const caption = photoCaption(post);
        let photo;
        if (delivery.photoMessageId) {
            // Незавершённые отправки прежнего формата уже могли создать фото без подписи.
            // Дополняем именно его, не создавая второго сообщения.
            try {
                photo = await call("editMessageCaption", {
                    chat_id: chatId, message_id: delivery.photoMessageId, caption, parse_mode: "HTML",
                });
            } catch (e) {
                if (!(e instanceof TelegramError) || e.code !== 400 || !/message is not modified/i.test(e.description)) throw e;
                photo = { message_id: delivery.photoMessageId };
            }
        } else {
            const image = await downloadImage(imageUrl, fetchTelegram);
            const form = new FormData();
            form.set("chat_id", chatId);
            form.set("caption", caption);
            form.set("parse_mode", "HTML");
            form.set("photo", image.blob, image.filename);
            photo = await request(fetchTelegram, botToken, "sendPhoto", { body: form });
        }
        await save({ ...delivery, photoMessageId: photo.message_id, messageId: photo.message_id, complete: true });
        return photo;
    }

    const message = await call("sendMessage", {
        chat_id: chatId,
        text: post.text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
    });
    await save({ ...delivery, messageId: message.message_id, complete: true });
    return message;
};

/** Только загрузка файла и читающие методы Bot API, без публикации и редактирования. */
export const checkChannelPostForTelegram = async (
    post: TelegramPostInput,
    botToken: string | undefined,
    channelId: string | undefined,
    options: Pick<TelegramSendOptions, "fetch"> = {},
): Promise<TelegramPostCheck> => {
    const checkedAt = new Date().toISOString();
    try {
        const content = checkTelegramText(post);
        const fetchTelegram = options.fetch || undiciFetch;
        const image = post.imageUrl?.trim() ? await downloadImage(post.imageUrl.trim(), fetchTelegram) : null;
        const photo = image ? checkTelegramPhoto(new Uint8Array(await image.blob.arrayBuffer())) : undefined;
        if (!botToken || !channelId?.trim()) throw new Error("Не заданы TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID");
        const read = (method: "getMe" | "getChat" | "getChatMember", body: Record<string, unknown>) =>
            request(fetchTelegram, botToken, method, {
                headers: {"Content-Type": "application/json"}, body: JSON.stringify(body),
                signal: AbortSignal.timeout(15_000),
            });
        const me = await read("getMe", {});
        const chat = await read("getChat", {chat_id: normalizeChatId(channelId)});
        if (chat.type !== "channel") throw new Error("TELEGRAM_CHANNEL_ID должен указывать на канал");
        const member = await read("getChatMember", {chat_id: chat.id, user_id: me.id});
        if (member.status !== "creator" && !(member.status === "administrator" && member.can_post_messages === true)) {
            throw new Error("У бота нет права публиковать сообщения в этом канале");
        }
        return {status: "passed", checkedAt, ...content, ...(photo ? {photo} : {})};
    } catch (e) {
        return {status: "failed", checkedAt, error: e instanceof Error ? e.message : String(e)};
    }
};
