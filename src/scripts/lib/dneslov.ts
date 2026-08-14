// Обёртка над внешним API dneslov.org — уже используется на сайте для получения
// иконы и канонического названия памяти святого (см. src/app/saints/[id]/api.ts,
// src/app/reading/DneslovImages.tsx). Используем тот же путь: dneslovId текста -> память -> фото/название.
import { Agent, fetch as undiciFetch, RequestInfo, RequestInit } from "undici";

interface DneslovMemo {
    title?: string;
    eventId?: string;
    description?: string;
}

interface DneslovMemory {
    slug?: string;
    memoes?: DneslovMemo[];
}

interface DneslovImage {
    url: string;
}

const MEMORY_URL = (id: string) => `https://dneslov.org/api/v0/memories/${id}.json`;
const IMAGES_URL = (id: string, eventId?: string | null) =>
    `https://dneslov.org/api/v1/images.json?m=${id}${eventId ? `&e=${eventId}` : ""}`;
const CDN = "https://cdn.dneslov.org";

const resolveUrl = (url: string) => (url.includes("https") ? url : `${CDN}${url}`);

// dneslov.org отдаёт неполную цепочку сертификатов на некоторых серверах (UNABLE_TO_VERIFY_LEAF_SIGNATURE) —
// сначала стоит попробовать починить это на уровне ОС (обновить ca-certificates), это безопасно и правильно.
// Если проблема именно в сертификате dneslov.org, а не в CA-хранилище сервера — включить точечный обход
// ТОЛЬКО для запросов к dneslov.org переменной окружения DNESLOV_INSECURE_TLS=true. По умолчанию выключено,
// на остальные запросы приложения (включая fetch внутри /api/v1/days/...) это никак не влияет.
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });
let warned = false;

const dneslovFetch = async (url: string) => {
    if (process.env.DNESLOV_INSECURE_TLS === "true") {
        if (!warned) {
            console.warn(
                "dneslov: проверка TLS-сертификата отключена для запросов к dneslov.org (DNESLOV_INSECURE_TLS=true)",
            );
            warned = true;
        }
        return undiciFetch(url as RequestInfo, { dispatcher: insecureAgent } as RequestInit);
    }
    return fetch(url);
};

export const getDneslovMemory = async (dneslovId?: string | null): Promise<DneslovMemory | null> => {
    if (!dneslovId) {
        console.log("dneslov: у текста не заполнен dneslovId — пропускаю");
        return null;
    }
    try {
        const memoryRes = await dneslovFetch(MEMORY_URL(dneslovId));
        if (!memoryRes.ok) {
            console.warn(`dneslov: memories/${dneslovId}.json ответил ${memoryRes.status}`);
            return null;
        }
        const memory = await memoryRes.json();
        if (!memory?.slug) {
            console.warn(`dneslov: memories/${dneslovId}.json без slug:`, JSON.stringify(memory).slice(0, 300));
            return null;
        }

        const detailsRes = await dneslovFetch(`https://dneslov.org/${memory.slug}.json`);
        if (!detailsRes.ok) {
            console.warn(`dneslov: ${memory.slug}.json ответил ${detailsRes.status}`);
            return null;
        }
        return await detailsRes.json();
    } catch (e) {
        console.error("dneslov: не удалось получить память", e);
        return null;
    }
};

export const getDneslovImage = async (
    dneslovId?: string | null,
    dneslovEventId?: string | null,
): Promise<string | null> => {
    if (!dneslovId) return null;
    try {
        const res = await dneslovFetch(IMAGES_URL(dneslovId, dneslovEventId));
        if (!res.ok) {
            console.warn(`dneslov: images.json?m=${dneslovId} ответил ${res.status}`);
            return null;
        }
        const images: DneslovImage[] = await res.json();
        if (!images?.length) {
            console.warn(`dneslov: images.json?m=${dneslovId} вернул пустой список`);
            return null;
        }
        return resolveUrl(images[0].url);
    } catch (e) {
        console.error("dneslov: не удалось получить фото", e);
        return null;
    }
};
