// Разговор страницы со служебным воркером об отложенном чтении.
//
// Воркер — единственный, кто может положить ответ в кэш так, чтобы браузер потом
// сам достал его при переходе по ссылке. Поэтому страница не сохраняет ничего
// сама, а просит воркера и ждёт ответа по MessageChannel: канал одноразовый,
// ответ приходит ровно на свою просьбу, и одновременные нажатия не путаются.

export type SavedPage = {
    /** Адрес без домена, как его видит браузер: «/calendar/march-30». */
    url: string;
    /** Человеческое название — то, что показывается в списке отложенного. */
    label: string;
    savedAt: number;
    bytes: number;
};

export type OfflineAnswer =
    | { ok: true; saved: SavedPage[]; bytes?: number }
    | { ok: false; error: string };

/** Подкладки страницы: всё, без чего сохранённый HTML откроется голым. */
const ASSET_PATH = /^\/(_next\/static|fonts|icons|images)\//;

export const isSupported = () =>
    typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "caches" in window;

/**
 * Адрес текущей страницы для кэша: без домена и без якоря. Якорь до сервера не
 * доходит и ключом кэша быть не должен — иначе одно и то же чтение, открытое со
 * сноски, считалось бы другой страницей.
 */
export const currentPageUrl = () => window.location.pathname + window.location.search;

/**
 * Что грузила эта страница. Смотрим и в разметку, и в журнал загрузок: шрифты
 * приходят из CSS, в разметке их нет вовсе, а в журнале есть.
 */
const collectAssets = (): string[] => {
    const urls = new Set<string>();

    const add = (raw?: string | null) => {
        if (!raw) return;
        try {
            const url = new URL(raw, window.location.href);
            if (url.origin !== window.location.origin) return;
            if (!ASSET_PATH.test(url.pathname)) return;
            urls.add(url.pathname + url.search);
        } catch (e) {
            // не адрес — не берём
        }
    };

    document
        .querySelectorAll("link[href]")
        .forEach((node) => add(node.getAttribute("href")));
    document
        .querySelectorAll("script[src]")
        .forEach((node) => add(node.getAttribute("src")));
    document
        .querySelectorAll("img[src]")
        .forEach((node) => add(node.getAttribute("src")));

    try {
        performance
            .getEntriesByType("resource")
            .forEach((entry) => add(entry.name));
    } catch (e) {
        // журнала загрузок нет — обойдёмся разметкой
    }

    return [...urls];
};

/**
 * Воркер, готовый отвечать. `ready` не отвергается никогда — в разработке, где
 * воркер не регистрируется вовсе, оно просто висит, поэтому ждём с оглядкой.
 */
const activeWorker = async (): Promise<ServiceWorker | null> => {
    if (!isSupported()) return null;
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
    const registration = await Promise.race([navigator.serviceWorker.ready, timeout]);
    return registration?.active || null;
};

const ask = async (message: object, waitMs = 60000): Promise<OfflineAnswer> => {
    const worker = await activeWorker();
    if (!worker) return { ok: false, error: "офлайн-режим ещё не включился" };

    return new Promise((resolve) => {
        const channel = new MessageChannel();
        const timer = setTimeout(
            () => resolve({ ok: false, error: "воркер не ответил" }),
            waitMs,
        );

        channel.port1.onmessage = (event) => {
            clearTimeout(timer);
            resolve(event.data as OfflineAnswer);
        };

        worker.postMessage(message, [channel.port2]);
    });
};

export const listSaved = () => ask({ type: "offline:list" }, 5000);

export const savePage = (url: string, label: string) =>
    ask({ type: "offline:save", url, label, assets: collectAssets() });

export const forgetPage = (url: string) => ask({ type: "offline:forget", url });

export const clearSaved = () => ask({ type: "offline:clear" });

export const savedUsage = () => ask({ type: "offline:usage" });

/** Размер по-русски: до мегабайта — в килобайтах, дальше — с одним знаком после запятой. */
export const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} МБ`;
};

/**
 * Русский счёт: одна страница, две страницы, пять страниц. Правило общее —
 * одиннадцать-четырнадцать идут по последней форме, несмотря на единицу в конце.
 */
export const plural = (count: number, one: string, few: string, many: string) => {
    const tens = count % 100;
    if (tens >= 11 && tens <= 14) return many;
    const units = count % 10;
    if (units === 1) return one;
    if (units >= 2 && units <= 4) return few;
    return many;
};

export const formatSavedAt = (savedAt: number) =>
    new Date(savedAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
