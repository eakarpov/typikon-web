// Обёртка над внешним API dneslov.org — уже используется на сайте для получения
// иконы и канонического названия памяти святого (см. src/app/saints/[id]/api.ts,
// src/app/reading/DneslovImages.tsx). Используем тот же путь: dneslovId текста -> память -> фото/название.
import { Agent, fetch as undiciFetch, RequestInfo, RequestInit } from "undici";

// Реальная форма ответа {slug}.json (проверено на живых данных, см. buildPost.ts) — не совпадает
// с тем, что ожидает мобильное приложение (DneslovMemory{memoes, links} прямо на верхнем уровне) —
// там, похоже, тоже не находит "memoes" на верхнем уровне и падает на пустом месте.
// Реально: верхний уровень — сама "память" (персона/событие), с уже готовым short_name,
// и массивом events — у каждого события своя подборка memoes с чином (orders).
export interface DneslovOrderTag {
    name: string;
    slug: string;
}

export interface DneslovMemo {
    id?: number;
    title?: string;
    // Карта "сокращение чина -> каноническое сокращение", например {"ап":"мч","мч":"мч"} —
    // запись, где ключ === значению, и есть каноническая категория для этой памяти.
    orders?: Record<string, string>;
    year_date?: string;
}

export interface DneslovEvent {
    id?: number;
    kind_code?: string;
    orders?: DneslovOrderTag[];
    memoes?: DneslovMemo[];
}

export interface DneslovMemory {
    slug?: string;
    short_name?: string;
    gallery_title?: string;
    events?: DneslovEvent[];
}

interface DneslovImage {
    url: string;
}

// Внимание: memories/{slug}.json стабильно отдаются dneslov.org только по http — так же,
// как на сайте в getDneslovObject (src/app/saints/[id]/api.ts). По https эти два конкретных
// эндпоинта не работают (не только сертификат — похоже, дело в самом приложении на их сервере),
// в отличие от api/v1/images.json и roundels.json, которые по https работают нормально.
const MEMORY_URL = (id: string) => `http://dneslov.org/api/v0/memories/${id}.json`;
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

const dneslovFetch = async (url: string, init: { signal?: AbortSignal } = {}) => {
    if (process.env.DNESLOV_INSECURE_TLS === "true") {
        if (!warned) {
            console.warn(
                "dneslov: проверка TLS-сертификата отключена для запросов к dneslov.org (DNESLOV_INSECURE_TLS=true)",
            );
            warned = true;
        }
        return undiciFetch(url as RequestInfo, { ...init, dispatcher: insecureAgent } as RequestInit);
    }
    return fetch(url, init);
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

        const detailsRes = await dneslovFetch(`http://dneslov.org/${memory.slug}.json`);
        if (!detailsRes.ok) {
            console.warn(`dneslov: ${memory.slug}.json ответил ${detailsRes.status}`);
            return null;
        }
        const details = await detailsRes.json();
        // slug гарантированно берём из первого ответа — на details он может отсутствовать
        return { ...details, slug: memory.slug };
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

// --- Снимок памяти для собственного каталога (src/scripts/sync-dneslov.ts) ---
//
// От getDneslovMemory выше отличается тем, что нужно снимку, а не показу страницы:
//
//   1. РАЗЛИЧАЕТ ОТКАЗЫ. 404 значит, что памяти у них больше нет и наш внешний ключ
//      протух — это событие, о котором надо сказать человеку. Любая другая неудача
//      не значит ничего, кроме «сейчас не отвечает», и снимок прошлого раза остаётся
//      в силе. Прежняя функция возвращает null в обоих случаях, и по нему эти два
//      исхода не различить.
//   2. ПРОБУЕТ ОБЕ СХЕМЫ. В шапке этого файла записано, что memories/*.json ходят
//      только по http; замер в src/lib/dneslov.ts от 2026-08-27 застал обратное —
//      по http соединение не встаёт вовсе, по https отвечает через раз. Значит дело
//      не в схеме, а в нестабильности сервиса, и полагаться на одну нельзя.
//   3. ПОВТОРЯЕТ. За проход мы обходим сотни памятей; одна случайная неудача не
//      должна оставлять дыру в снимке до следующего запуска.
export type MemorySnapshot =
    | { status: "ok"; slug: string; memory: any; details: any }
    | { status: "gone" }
    | { status: "error"; error: string };

const SCHEMES = ["https", "http"];
const MEMORY_PATH = (id: string) => `dneslov.org/api/v0/memories/${id}.json`;
const DETAILS_PATH = (slug: string) => `dneslov.org/${slug}.json`;

/** 404 отделяем от всего остального: он означает «нет такой памяти», а не «не дозвонились». */
class Gone extends Error {}

const fetchJson = async (path: string, timeoutMs: number): Promise<any> => {
    let last: unknown = null;

    for (const scheme of SCHEMES) {
        try {
            const res = await dneslovFetch(`${scheme}://${path}`, { signal: AbortSignal.timeout(timeoutMs) });
            if (res.status === 404) throw new Gone(path);
            if (!res.ok) throw new Error(`ответил ${res.status}`);
            // 204 и пустое тело — это ОТВЕТ «ничего нет», а не сбой. Так отвечает
            // images.json у памяти без изображений, и таких больше половины. Пока
            // здесь стоял голый res.json(), он падал на пустом теле, и «картинок нет»
            // засчитывалось как «не дозвонились»: пятьсот памятей переспрашивались
            // проходом за проходом, и ни одна не могла ответить иначе.
            if (res.status === 204) return null;
            const body = (await res.text()).trim();
            return body ? JSON.parse(body) : null;
        } catch (e) {
            if (e instanceof Gone) throw e;
            last = e;
        }
    }

    throw new Error(`${path}: ${last instanceof Error ? last.message : last}`);
};

export const fetchMemorySnapshot = async (
    id: string,
    { retries = 3, timeoutMs = 15000, pauseMs = 1500 } = {},
): Promise<MemorySnapshot> => {
    for (let attempt = 0; ; attempt++) {
        try {
            const memory = await fetchJson(MEMORY_PATH(id), timeoutMs);
            // slug — единственное, ради чего нужен первый запрос: подробности лежат
            // по имени, а не по номеру. Нет slug (в том числе пустой ответ) — считаем
            // ответ негодным, а не пустым.
            if (!memory?.slug) throw new Error(`memories/${id}.json без slug`);

            const details = await fetchJson(DETAILS_PATH(memory.slug), timeoutMs);
            return { status: "ok", slug: String(memory.slug), memory, details };
        } catch (e) {
            if (e instanceof Gone) return { status: "gone" };
            if (attempt >= retries) {
                return { status: "error", error: e instanceof Error ? e.message : String(e) };
            }
            await new Promise((r) => setTimeout(r, pauseMs * (attempt + 1)));
        }
    }
};

// --- Снимок ссылок на изображения ---
//
// Отдельно от fetchMemorySnapshot, а не третьим запросом внутри него: подробности
// памяти уже сняты по всему каталогу, и повторять ради картинок два лишних запроса
// на каждую из восьмисот памятей незачем.
//
// САМИ КАРТИНКИ НЕ ХРАНИМ, только адреса. Значит зависимость от их CDN никуда не
// девается — она лишь переезжает с рендера на загрузку страницы у читателя. Зато
// уходит запрос за СПИСКОМ, который сегодня уходит из браузера каждого читателя
// (см. src/app/reading/DneslovImages.tsx), а с ним и его адрес в чужие логи.
//
// Адреса протухают: закэссированный однажды отдаст 404 там, где свежий запрос вернул
// бы новый. Поэтому снимок обновляемый, а разметка обязана переживать битую картинку.
export interface SnapshotImage {
    url: string;
    thumbUrl: string | null;
    type?: string | null;
    title?: string | null;
}

const IMAGES_PATH = (id: string) => `dneslov.org/api/v1/images.json?m=${id}`;

export const fetchMemoryImages = async (
    id: string,
    { retries = 1, timeoutMs = 10000, pauseMs = 1500 } = {},
): Promise<{ status: "ok"; images: SnapshotImage[] } | { status: "error"; error: string }> => {
    for (let attempt = 0; ; attempt++) {
        try {
            const list = await fetchJson(IMAGES_PATH(id), timeoutMs);
            const images: SnapshotImage[] = (Array.isArray(list) ? list : [])
                .filter((item: any) => item?.url)
                .map((item: any) => ({
                    url: resolveUrl(String(item.url)),
                    thumbUrl: item.thumb_url ? resolveUrl(String(item.thumb_url)) : null,
                    type: item.type ?? null,
                    title: item.title ?? null,
                }));
            return { status: "ok", images };
        } catch (e) {
            // 404 здесь значит «картинок нет», а не «памяти нет»: пустой список — тоже ответ.
            if (e instanceof Gone) return { status: "ok", images: [] };
            if (attempt >= retries) {
                return { status: "error", error: e instanceof Error ? e.message : String(e) };
            }
            await new Promise((r) => setTimeout(r, pauseMs * (attempt + 1)));
        }
    }
};
